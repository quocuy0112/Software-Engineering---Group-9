import { createHash } from "node:crypto";

export type FixtureAccount = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  password: string;
};

export type FixtureSession = {
  id: string;
  token: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

export type CapturedFixtureMessage = {
  kind: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  capturedAt: Date;
};

function deterministicValue(namespace: string, label: string): string {
  return createHash("sha256")
    .update(`smarthire-test:${namespace}:${label}`, "utf8")
    .digest("hex");
}

export class ControlledFixtureClock {
  #current: Date;

  constructor(initial = "2026-07-31T00:00:00.000Z") {
    this.#current = new Date(initial);
    if (Number.isNaN(this.#current.getTime())) {
      throw new Error("ControlledFixtureClock requires a valid UTC instant");
    }
  }

  now(): Date {
    return new Date(this.#current);
  }

  set(instant: Date | string): Date {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime())) {
      throw new Error("ControlledFixtureClock cannot set an invalid instant");
    }
    this.#current = next;
    return this.now();
  }

  advance(milliseconds: number): Date {
    if (!Number.isSafeInteger(milliseconds)) {
      throw new Error("ControlledFixtureClock advance must be an integer");
    }
    this.#current = new Date(this.#current.getTime() + milliseconds);
    return this.now();
  }
}

export class MailCaptureFixture {
  #messages: CapturedFixtureMessage[] = [];

  constructor(private readonly clock: ControlledFixtureClock) {}

  capture(
    message: Omit<CapturedFixtureMessage, "capturedAt">,
  ): CapturedFixtureMessage {
    const captured = { ...message, capturedAt: this.clock.now() };
    this.#messages.push(captured);
    return structuredClone(captured);
  }

  all(): CapturedFixtureMessage[] {
    return structuredClone(this.#messages);
  }

  forRecipient(recipient: string): CapturedFixtureMessage[] {
    return this.all().filter((message) => message.recipient === recipient);
  }

  byKind(kind: string): CapturedFixtureMessage[] {
    return this.all().filter((message) => message.kind === kind);
  }

  clear(): void {
    this.#messages = [];
  }
}

export function buildAccountFixture(
  label: string,
  namespace = "profile-account",
): FixtureAccount {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const suffix = deterministicValue(namespace, `${label}:account`).slice(0, 12);

  return {
    id: `usr_${suffix}`,
    name: `Candidate ${label}`,
    email: `${safeLabel}-${suffix}@example.test`,
    normalizedEmail: `${safeLabel}-${suffix}@example.test`,
    password: `Fixture-${suffix}-Password!`,
  };
}

export function buildSessionFixture(
  account: FixtureAccount,
  index: number,
  clock: ControlledFixtureClock,
): FixtureSession {
  const createdAt = clock.now();
  const suffix = deterministicValue(account.id, `session:${index}`);

  return {
    id: `ses_${suffix.slice(0, 16)}`,
    token: `fixture_${suffix}`,
    userId: account.id,
    createdAt,
    updatedAt: createdAt,
    lastActivityAt: createdAt,
    expiresAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
    absoluteExpiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
  };
}

export function buildTwoAccountFixture(options?: {
  namespace?: string;
  sessionsPerAccount?: number;
  initialTime?: string;
}) {
  const namespace = options?.namespace ?? "profile-account";
  const sessionsPerAccount = options?.sessionsPerAccount ?? 2;
  if (
    !Number.isSafeInteger(sessionsPerAccount) ||
    sessionsPerAccount < 1 ||
    sessionsPerAccount > 5
  ) {
    throw new Error("sessionsPerAccount must be an integer from 1 to 5");
  }

  const clock = new ControlledFixtureClock(options?.initialTime);
  const accountA = buildAccountFixture("A", namespace);
  const accountB = buildAccountFixture("B", namespace);

  return {
    clock,
    mail: new MailCaptureFixture(clock),
    accounts: [accountA, accountB] as const,
    sessions: {
      [accountA.id]: Array.from({ length: sessionsPerAccount }, (_, index) =>
        buildSessionFixture(accountA, index, clock),
      ),
      [accountB.id]: Array.from({ length: sessionsPerAccount }, (_, index) =>
        buildSessionFixture(accountB, index, clock),
      ),
    },
  };
}
