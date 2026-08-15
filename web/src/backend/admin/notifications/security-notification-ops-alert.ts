import "server-only";
import { prisma } from "@/backend/database/prisma";
import { notifyActionableAdministrators } from "@/backend/notifications/admin-notification-fanout";

export type SecurityNotificationOpsAlert = {
  alertKey: string;
  workReference: string;
  eventKind: string;
  deliveryDeadline: string;
  safeFailureCategory: string;
};

export interface SecurityNotificationOpsAlertAdapter {
  send(alert: SecurityNotificationOpsAlert): Promise<void>;
}

export interface SecurityNotificationOpsMetricSink {
  increment(input: { eventKind: string; safeFailureCategory: string }): void;
}

class WebhookOpsAlertAdapter implements SecurityNotificationOpsAlertAdapter {
  constructor(private readonly url: string) {}
  async send(alert: SecurityNotificationOpsAlert) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-smarthire-idempotency-key": alert.alertKey,
      },
      body: JSON.stringify(alert),
    });
    if (!response.ok) throw new Error("OPS_ALERT_PROVIDER_FAILED");
  }
}

class SafeLogOpsAlertAdapter implements SecurityNotificationOpsAlertAdapter {
  async send(alert: SecurityNotificationOpsAlert) {
    console.warn(JSON.stringify({ type: "account_security_dead", ...alert }));
  }
}

const safeMetricSink: SecurityNotificationOpsMetricSink = {
  increment(input) {
    console.warn(
      JSON.stringify({
        metric: "account_security_manual_intervention_total",
        ...input,
      }),
    );
  },
};

export function selectedSecurityNotificationOpsAlertAdapter() {
  const webhook = process.env.ADMIN_OPS_ALERT_WEBHOOK_URL;
  return webhook
    ? new WebhookOpsAlertAdapter(webhook)
    : new SafeLogOpsAlertAdapter();
}

export async function alertSecurityNotificationDead(
  emailOutboxId: string,
  adapter: SecurityNotificationOpsAlertAdapter = selectedSecurityNotificationOpsAlertAdapter(),
  metric: SecurityNotificationOpsMetricSink = safeMetricSink,
  now = new Date(),
) {
  const work = await prisma.securityNotificationWork.findFirst({
    where: {
      emailOutboxId,
      status: "MANUAL_INTERVENTION_REQUIRED",
      opsAlertedAt: null,
    },
    select: {
      id: true,
      kind: true,
      targetUserId: true,
      deliveryDeadline: true,
      failureCategory: true,
    },
  });
  if (!work) return false;
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.securityNotificationWork.updateMany({
      where: {
        id: work.id,
        status: "MANUAL_INTERVENTION_REQUIRED",
        opsAlertedAt: null,
      },
      data: { opsAlertedAt: now },
    });
    if (updated.count !== 1) return false;
    await notifyActionableAdministrators(tx, {
      kind: "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
      eventKey: `${work.id}:manual-intervention`,
      correlationId: `delivery-intervention:${work.id}`,
      occurredAt: now,
      contextType: "ACCOUNT",
      contextId: work.targetUserId,
      state: "MANUAL_INTERVENTION_REQUIRED",
    });
    return true;
  });
  if (!claimed) return false;
  const alert = {
    alertKey: `account-security-dead:${work.id}`,
    workReference: work.id,
    eventKind: work.kind,
    deliveryDeadline: work.deliveryDeadline.toISOString(),
    safeFailureCategory: work.failureCategory ?? "ATTEMPTS_EXHAUSTED",
  };
  try {
    await adapter.send(alert);
    try {
      metric.increment({
        eventKind: alert.eventKind,
        safeFailureCategory: alert.safeFailureCategory,
      });
    } catch {
      // Observability must not change the terminal delivery truth.
    }
    return true;
  } catch (error) {
    await prisma.securityNotificationWork.updateMany({
      where: { id: work.id, opsAlertedAt: now },
      data: { opsAlertedAt: null },
    });
    throw error;
  }
}

export async function alertOutstandingSecurityNotificationDead(limit = 100) {
  const rows = await prisma.securityNotificationWork.findMany({
    where: {
      status: "MANUAL_INTERVENTION_REQUIRED",
      opsAlertedAt: null,
      emailOutboxId: { not: null },
    },
    select: { emailOutboxId: true },
    orderBy: [{ deliveryDeadline: "asc" }, { id: "asc" }],
    take: limit,
  });
  let alerted = 0;
  for (const row of rows) {
    try {
      if (await alertSecurityNotificationDead(row.emailOutboxId!)) alerted += 1;
    } catch {
      // Retry on the next reconciliation cycle after CAS is released.
    }
  }
  return alerted;
}
