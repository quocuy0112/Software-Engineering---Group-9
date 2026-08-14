"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { preparationPatchSchema } from "@/shared/contracts/employer-verification/business-verification";
import {
  registryLookupConfirmsBusiness,
  type EmployerVerificationPreparationResponse,
} from "@/shared/contracts/employer-verification/business-verification-responses";
import styles from "./employer-verification-page.module.css";

type Item = {
  id: string;
  submittedCompanyName: string;
  normalizedTaxIdentifier: string;
  requestedRole: string;
  state: string;
  resubmissionCount: number;
  createdAt: string;
};

type Preparation = EmployerVerificationPreparationResponse["data"];

const statusPresentation: Record<string, { label: string; tone: string }> = {
  PENDING_CHECKS: { label: "Safety checks", tone: "info" },
  PENDING_REVIEW: { label: "Under review", tone: "warning" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Not approved", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

function presentStatus(state: string) {
  return statusPresentation[state] ?? {
    label: state.replaceAll("_", " ").toLowerCase(),
    tone: "neutral",
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({ code: "REQUEST_FAILED" }));
  if (!response.ok) {
    throw Object.assign(new Error(body.code ?? "REQUEST_FAILED"), {
      body,
      status: response.status,
    });
  }
  return body;
}

function draftFieldError(name: string) {
  const messages: Record<string, string> = {
    applicantLegalName: "Legal company name is required and must be at most 240 characters.",
    applicantRegisteredAddress: "Registered address must contain 5–500 characters.",
    operatingAddress: "Operating address must contain 5–500 characters.",
    companyPhone: "Enter a valid Vietnamese phone number such as 0901 234 567.",
    website: "Enter a public company domain using HTTPS, without a path, query, or fragment.",
    relationship: "Select a valid relationship to the company.",
    currentJobTitle: "Current job title must contain 2–120 characters.",
    authorityExplanation: "Authority explanation must contain 20–500 characters.",
    mismatchExplanation: "Difference explanation must contain 20–500 characters when provided.",
  };
  return messages[name] ?? "This field is invalid. Review it and try again.";
}

export function EmployerVerificationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean | null>>({});
  const [companyEmail, setCompanyEmail] = useState("");
  const [taxIdentifier, setTaxIdentifier] = useState("");
  const [busy, setBusy] = useState<string>();
  const preparationRef = useRef<Preparation | null>(null);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const resubmitInFlightRef = useRef(new Set<string>());

  async function loadRequests() {
    const body = (await requestJson("/api/employer-verifications")) as {
      data: Item[];
    };
    setItems(body.data);
    return body.data;
  }

  async function loadPreparation() {
    const body = (await requestJson(
      "/api/employer-verifications/preparation",
    )) as EmployerVerificationPreparationResponse;
    preparationRef.current = body.data;
    setPreparation(body.data);
    setDraft(body.data.draft);
    setTaxIdentifier(body.data.lookup?.taxIdentifier ?? "");
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      requestJson("/api/employer-verifications"),
      requestJson("/api/employer-verifications/preparation"),
    ])
      .then(([requests, current]) => {
        if (!active) return;
        preparationRef.current = current.data;
        setItems(requests.data);
        setPreparation(current.data);
        setDraft(current.data.draft);
        setTaxIdentifier(current.data.lookup?.taxIdentifier ?? "");
      })
      .catch(() => toast.error("Employer verification could not be loaded."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "company-email-token",
    );
    if (!token) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    void requestJson("/api/employer-verifications/company-email/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        toast.success("Company email verified.", { id: "company-email" });
        await loadPreparation();
      })
      .catch(() =>
        toast.error("This verification link is invalid or expired.", {
          id: "company-email",
        }),
      )
      .finally(() => undefined);
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("lookup");
    try {
      const body = (await requestJson(
        "/api/employer-verifications/registry-lookups",
        { method: "POST", body: JSON.stringify({ taxIdentifier }) },
      )) as EmployerVerificationPreparationResponse;
      preparationRef.current = body.data;
      setPreparation(body.data);
      setDraft(body.data.draft);
      setCompanyEmail("");
      setTaxIdentifier(body.data.lookup?.taxIdentifier ?? taxIdentifier);
      if (body.data.lookup && registryLookupConfirmsBusiness(body.data.lookup.outcome)) {
        toast.success("Registered business record found.", { id: "business-lookup" });
      } else {
        toast.error(
          body.data.lookup?.outcome === "NOT_FOUND"
            ? "This tax identifier was not found in the business registry."
            : "The registry could not confirm this tax identifier. Try again later.",
          { id: "business-lookup" },
        );
      }
    } catch {
      toast.error("Enter a valid 10-digit tax identifier and try again.", {
        id: "business-lookup",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function resetTaxIdentifier() {
    setBusy("reset-lookup");
    try {
      const body = (await requestJson("/api/employer-verifications/preparation", {
        method: "DELETE",
      })) as EmployerVerificationPreparationResponse;
      preparationRef.current = body.data;
      setPreparation(body.data);
      setDraft(body.data.draft);
      setCompanyEmail("");
      setTaxIdentifier("");
      toast.success("Tax identifier cleared. Start the verification again.", {
        id: "business-lookup",
      });
    } catch {
      toast.error("The tax identifier could not be changed. Try again.", {
        id: "business-lookup",
      });
    } finally {
      setBusy(undefined);
    }
  }

  function saveDraft(name: string, value: string | boolean | null) {
    setDraft((current) => ({ ...current, [name]: value }));
    const run = async () => {
      const current = preparationRef.current;
      if (!current?.preparationId) return;
      const payload = preparationPatchSchema.safeParse({
        preparationId: current.preparationId,
        version: current.version,
        changes: { [name]: value },
      });
      if (!payload.success) {
        toast.error(draftFieldError(name), { id: `verification-draft-${name}` });
        return;
      }
      try {
        const body = (await requestJson(
          "/api/employer-verifications/preparation",
          {
            method: "PATCH",
            body: JSON.stringify(payload.data),
          },
        )) as EmployerVerificationPreparationResponse;
        preparationRef.current = body.data;
        setPreparation(body.data);
        setDraft(body.data.draft);
      } catch (error) {
        const failure = error as Error & { status?: number };
        if (failure.status === 409) {
          await loadPreparation();
          toast.error("The draft changed in another request. Latest values were restored.", {
            id: "verification-draft-conflict",
          });
          return;
        }
        toast.error(draftFieldError(name), { id: `verification-draft-${name}` });
      }
    };
    draftSaveQueueRef.current = draftSaveQueueRef.current.then(run, run);
    return draftSaveQueueRef.current;
  }

  async function issueEmail() {
    if (!preparation) return;
    setBusy("email");
    try {
      await requestJson(
        "/api/employer-verifications/company-email/challenges",
        {
          method: "POST",
          body: JSON.stringify({
            preparationVersion: preparation.version,
            email: companyEmail,
          }),
        },
      );
      toast.success("Verification email queued. Check the company inbox.", {
        id: "company-email",
      });
      await loadPreparation();
    } catch {
      toast.error("Use a valid company email and try again later.", {
        id: "company-email",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.querySelector<HTMLElement>(":invalid")?.focus();
      toast.error("Correct the highlighted fields before submitting.");
      return;
    }
    setBusy("submit");
    try {
      await requestJson("/api/employer-verifications", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: new FormData(form),
      });
      toast.success("Verification request received.");
      form.reset();
      preparationRef.current = null;
      setPreparation(null);
      setDraft({});
      await Promise.all([loadRequests(), loadPreparation()]);
    } catch {
      toast.error("The request needs attention. Check each field and retry.");
    } finally {
      setBusy(undefined);
    }
  }

  async function cancel(requestId: string) {
    setBusy(requestId);
    try {
      await requestJson(
        `/api/employer-verifications/${encodeURIComponent(requestId)}/cancel`,
        { method: "POST" },
      );
      toast.success("Verification request cancelled.");
      await loadRequests();
    } catch {
      toast.error("Cancellation failed.");
    } finally {
      setBusy(undefined);
    }
  }

  async function resubmit(
    requestId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (resubmitInFlightRef.current.has(requestId)) return;
    resubmitInFlightRef.current.add(requestId);
    const form = event.currentTarget;
    setBusy(requestId);
    try {
      await requestJson(
        `/api/employer-verifications/${encodeURIComponent(requestId)}/resubmit`,
        { method: "POST", body: new FormData(form) },
      );
      form.reset();
      toast.success("Replacement evidence received.");
      await loadRequests();
    } catch (error) {
      const code = (
        error as Error & { body?: { code?: string }; status?: number }
      ).body?.code;
      if (code === "TARGET_UNAVAILABLE") {
        const refreshed = await loadRequests().catch(() => undefined);
        const current = refreshed?.find((item) => item.id === requestId);
        if (
          current &&
          ["PENDING_CHECKS", "PENDING_REVIEW", "RESUBMITTED"].includes(
            current.state,
          )
        ) {
          form.reset();
          toast.success(
            "Replacement evidence was already received and is under review.",
          );
          return;
        }
      }
      toast.error("Replacement evidence could not be accepted.");
    } finally {
      resubmitInFlightRef.current.delete(requestId);
      setBusy(undefined);
    }
  }

  const lookupFacts = preparation?.lookup?.facts;
  const registryConfirmed = Boolean(
    preparation?.lookup &&
      taxIdentifier === preparation.lookup.taxIdentifier &&
      registryLookupConfirmsBusiness(preparation.lookup.outcome),
  );
  const emailVerified = preparation?.email.status === "VERIFIED";
  const relationship = String(draft.relationship ?? "");
  const authorityExplanationRequired = ["AUTHORIZED_EMPLOYEE", "OTHER"].includes(relationship);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Employer verification</p>
          <h1>Build a trusted company identity</h1>
          <p className={styles.intro}>
            Confirm registered facts, a reachable company mailbox, your
            relationship to the business, and one protected license document.
          </p>
        </div>
        <div className={styles.trustNote}>
          <span className={styles.trustIcon} aria-hidden="true">✓</span>
          <div><strong>Human-reviewed</strong><span>Registry data supports review; it never auto-approves access.</span></div>
        </div>
      </header>

      <div className={styles.applicationGrid}>
        <div className={styles.formStack}>
          <section className={`${styles.card} ${styles.formCard}`}>
            <div className={styles.sectionHeading}><span className={styles.sectionNumber}>1</span><div><h2>Registered business</h2><p>Start with the exact 10-digit enterprise tax identifier.</p></div></div>
            <form className={styles.inlineForm} onSubmit={lookup}>
              <label className={styles.field}><span>Vietnamese tax identifier</span><input name="taxIdentifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required value={taxIdentifier} readOnly={registryConfirmed} onChange={(event) => setTaxIdentifier(event.target.value)} aria-describedby="tax-help" /><small id="tax-help">Ten ASCII digits. A confirmed identifier is locked until you restart verification.</small></label>
              {registryConfirmed
                ? <button className={styles.secondaryButton} disabled={busy === "reset-lookup"} type="button" onClick={() => void resetTaxIdentifier()}>{busy === "reset-lookup" ? "Resetting…" : "Change tax identifier"}</button>
                : <button className={styles.primaryButton} disabled={busy === "lookup"} type="submit">{busy === "lookup" ? "Looking up…" : "Look up business"}</button>}
            </form>
            {preparation?.lookup && <div className={styles.registryPanel} data-outcome={preparation.lookup.outcome}><strong>{registryConfirmed ? "Registered business record found" : preparation.lookup.outcome === "NOT_FOUND" ? "Tax identifier not found" : "Registry confirmation unavailable"}</strong><span>Source: {preparation.lookup.sourceLabel} · checked {new Date(preparation.lookup.checkedAt).toLocaleString()}</span><dl><div><dt>Legal name</dt><dd>{lookupFacts?.legalName ?? "Not supplied by source"}</dd></div><div><dt>Registered address</dt><dd>{lookupFacts?.registeredAddress ?? "Not supplied by source"}</dd></div><div><dt>Established</dt><dd>{lookupFacts?.establishmentDate ?? "Not supplied by source"}</dd></div></dl>{!registryConfirmed && <p>Complete registry confirmation before continuing to company details.</p>}</div>}
          </section>

          {registryConfirmed && preparation?.lookup && <form className={styles.formStack} onSubmit={submit} noValidate>
            <input type="hidden" name="preparationId" value={preparation.preparationId ?? ""} />
            <input type="hidden" name="preparationVersion" value={preparation.version} />
            <input type="hidden" name="lookupSnapshotId" value={preparation.lookup.snapshotId} />
            <input type="hidden" name="taxIdentifier" value={preparation.lookup.taxIdentifier} />
            <input type="hidden" name="requestedRole" value="RECRUITER" />
            <input type="hidden" name="policyVersion" value="business-verification-consent-v1" />

            <section className={`${styles.card} ${styles.formCard}`}>
              <div className={styles.sectionHeading}><span className={styles.sectionNumber}>2</span><div><h2>Business information</h2><p>Review the confirmed registry values and provide the remaining normalized facts.</p></div></div>
              <div className={styles.form}>
                <label className={styles.field}><span>Legal company name</span><input name="applicantLegalName" required minLength={1} maxLength={240} value={String(draft.applicantLegalName ?? "")} onChange={(e) => setDraft({ ...draft, applicantLegalName: e.target.value })} onBlur={(e) => void saveDraft("applicantLegalName", e.target.value)} /></label>
                <label className={styles.field}><span>Registered address</span><textarea name="applicantRegisteredAddress" required minLength={5} maxLength={500} value={String(draft.applicantRegisteredAddress ?? "")} onChange={(e) => setDraft({ ...draft, applicantRegisteredAddress: e.target.value })} onBlur={(e) => void saveDraft("applicantRegisteredAddress", e.target.value)} /></label>
                <label className={styles.checkboxField}><input name="operatingAddressDiffers" type="checkbox" value="true" checked={Boolean(draft.operatingAddressDiffers)} onChange={(e) => void saveDraft("operatingAddressDiffers", e.target.checked)} /><span>Operating location differs from registered address</span></label>
                {Boolean(draft.operatingAddressDiffers) && <label className={styles.field}><span>Operating address</span><textarea name="operatingAddress" required minLength={5} maxLength={500} value={String(draft.operatingAddress ?? "")} onChange={(e) => setDraft({ ...draft, operatingAddress: e.target.value })} onBlur={(e) => void saveDraft("operatingAddress", e.target.value)} /></label>}
                <label className={styles.field}><span>Explain differences from registry (if any)</span><textarea name="mismatchExplanation" minLength={20} maxLength={500} value={String(draft.mismatchExplanation ?? "")} onChange={(e) => setDraft({ ...draft, mismatchExplanation: e.target.value })} onBlur={(e) => void saveDraft("mismatchExplanation", e.target.value || null)} /><small>Required when legal name or registered address differs from source facts. Use 20–500 characters when provided.</small></label>
              </div>
            </section>

            <section className={`${styles.card} ${styles.formCard}`}>
              <div className={styles.sectionHeading}><span className={styles.sectionNumber}>3</span><div><h2>Company contact</h2><p>Verify mailbox control; phone remains clearly unverified.</p></div></div>
              <div className={styles.form}>
                <div className={styles.verifiedRow}><span>Email status</span><strong data-verified={emailVerified}>{emailVerified ? `Verified: ${preparation.email.maskedEmail}` : preparation.email.status === "PENDING" ? `Pending: ${preparation.email.maskedEmail}` : "Not verified"}</strong></div>
                {!emailVerified && <div className={styles.emailForm} role="group" aria-label="Verify company email"><label className={styles.field}><span>Company email</span><input type="email" maxLength={254} required value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} /></label><button className={styles.secondaryButton} disabled={busy === "email"} type="button" onClick={() => void issueEmail()}>{busy === "email" ? "Queuing…" : "Send verification link"}</button></div>}
                <label className={styles.field}><span>Company phone</span><input name="companyPhone" required maxLength={32} placeholder="0901 234 567" value={String(draft.companyPhone ?? "")} onChange={(e) => setDraft({ ...draft, companyPhone: e.target.value })} onBlur={(e) => void saveDraft("companyPhone", e.target.value)} /><small>Stored in +84 format. No OTP is performed; this phone is unverified.</small></label>
                <label className={styles.field}><span>Company website (optional)</span><input name="website" type="text" maxLength={2048} placeholder="company.vn" value={String(draft.website ?? "")} onChange={(e) => setDraft({ ...draft, website: e.target.value })} onBlur={(e) => void saveDraft("website", e.target.value || null)} /><small>Public HTTPS origin only; paths, queries, fragments, localhost, and IP addresses are rejected.</small></label>
              </div>
            </section>

            <section className={`${styles.card} ${styles.formCard}`}>
              <div className={styles.sectionHeading}><span className={styles.sectionNumber}>4</span><div><h2>Your authority and evidence</h2><p>Explain your relationship and consent to protected document processing.</p></div></div>
              <div className={styles.form}>
                <label className={styles.field}><span>Relationship to company</span><select name="relationship" required value={relationship} onChange={(e) => { setDraft({ ...draft, relationship: e.target.value }); void saveDraft("relationship", e.target.value); }}><option value="">Select relationship</option><option value="LEGAL_OWNER">Legal owner</option><option value="AUTHORIZED_EMPLOYEE">Authorized employee</option><option value="INVITED_MEMBER">Invited member</option><option value="EXISTING_OWNER_APPROVAL">Existing owner approval</option><option value="OTHER">Other</option></select></label>
                <label className={styles.field}><span>Current job title</span><input name="currentJobTitle" required minLength={2} maxLength={120} value={String(draft.currentJobTitle ?? "")} onChange={(e) => setDraft({ ...draft, currentJobTitle: e.target.value })} onBlur={(e) => void saveDraft("currentJobTitle", e.target.value)} /></label>
                {authorityExplanationRequired && <label className={styles.field}><span>Authority explanation</span><textarea name="authorityExplanation" required minLength={20} maxLength={500} value={String(draft.authorityExplanation ?? "")} onChange={(e) => setDraft({ ...draft, authorityExplanation: e.target.value })} onBlur={(e) => void saveDraft("authorityExplanation", e.target.value)} /><small>Required for authorized employees and Other; use 20–500 characters.</small></label>}
                <label className={`${styles.field} ${styles.fileField}`}><span>Business license</span><input name="document" type="file" accept="application/pdf,image/png,image/jpeg" required /><small>PDF, PNG, or JPEG · 1 byte to 5,000,000 bytes.</small></label>
                <label className={styles.checkboxField}><input name="accuracyDeclaration" type="checkbox" value="true" required /><span>I declare that these business and authority details are accurate.</span></label>
                <label className={styles.checkboxField}><input name="documentProcessingConsent" type="checkbox" value="true" required /><span>I consent to safety checking and human review of this business document.</span></label>
                <button className={styles.primaryButton} disabled={busy === "submit" || !emailVerified} type="submit">{busy === "submit" ? "Submitting…" : emailVerified ? "Submit recruiter application" : "Verify company email to submit"}</button>
              </div>
            </section>
          </form>}
        </div>

        <aside className={`${styles.card} ${styles.processCard}`}><p className={styles.eyebrow}>Review signals</p><h2>What the administrator sees</h2><ol className={styles.processList}><li><span>1</span><div><strong>Registry snapshot</strong><p>Source, checked time, and exact field differences.</p></div></li><li><span>2</span><div><strong>Contact control</strong><p>Verified mailbox plus unverified phone and website-domain signals.</p></div></li><li><span>3</span><div><strong>Authority evidence</strong><p>Your relationship, explanation, consent, and protected license.</p></div></li></ol><div className={styles.requirementNote}><strong>Human decision only</strong><p>No lookup, email, phone, or website signal can approve or reject this request automatically.</p></div></aside>
      </div>

      <section className={styles.historySection}><div className={styles.historyHeading}><div><p className={styles.eyebrow}>Application history</p><h2>Your recruiter applications</h2></div>{items.length > 0 && <span className={styles.applicationCount}>{items.length} requests</span>}</div>{items.length ? <ul className={styles.applicationList}>{items.map((item) => { const status = presentStatus(item.state); return <li className={styles.applicationCard} key={item.id}><div className={styles.applicationHeader}><div><strong>{item.submittedCompanyName}</strong><span>Submitted {new Date(item.createdAt).toLocaleDateString()}</span></div><span className={styles.statusBadge} data-tone={status.tone}>{status.label}</span></div><dl className={styles.applicationMeta}><div><dt>Tax identifier</dt><dd>{item.normalizedTaxIdentifier}</dd></div><div><dt>Requested role</dt><dd>{item.requestedRole.toLowerCase()}</dd></div><div><dt>Resubmissions</dt><dd>{item.resubmissionCount} of 3</dd></div></dl>{["PENDING_CHECKS", "PENDING_REVIEW", "CHANGES_REQUESTED"].includes(item.state) && <button className={styles.secondaryButton} disabled={busy === item.id} onClick={() => void cancel(item.id)} type="button">Cancel request</button>}{item.state === "CHANGES_REQUESTED" && item.resubmissionCount < 3 && <form className={styles.resubmitForm} onSubmit={(event) => void resubmit(item.id, event)}><label className={styles.field}><span>Replacement business license</span><input name="document" type="file" accept="application/pdf,image/png,image/jpeg" required /></label><button className={styles.primaryButton} disabled={busy === item.id} type="submit">Resubmit evidence</button></form>}</li>; })}</ul> : <div className={styles.emptyState}><span aria-hidden="true">⌁</span><div><strong>No verification requests.</strong><p>Your submitted applications will appear here.</p></div></div>}</section>
    </main>
  );
}
