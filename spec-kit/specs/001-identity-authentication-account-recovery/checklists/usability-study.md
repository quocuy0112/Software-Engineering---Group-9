# Post-implementation usability study

Status: protocol ready; no human participant study has been executed. SC-001 and SC-012 therefore remain post-implementation validation gates and are not claimed as achieved by automated tests.

## Participants and sample

Recruit at least 20 first-time SmartHire users who have not contributed to the implementation. Include a mix of desktop and mobile users and participants who rely on keyboard navigation. Exclude anyone who has previously rehearsed the tasks. Record only consented, non-sensitive demographics needed to interpret results.

## Study setup

Use a production-like test deployment with seeded disposable accounts, capture email, synthetic tokens, no real candidate/recruiter data, and screen-reader/keyboard tools requested by participants. Reset state before each participant. The facilitator reads the same neutral prompt, provides no step-by-step help, and records assistance requests without revealing credentials or codes.

## Tasks and thresholds

1. SC-001 registration: starting at the public landing/auth shell, create an account, locate the captured verification message, verify the address, and reach the login-ready state. Success requires completion without facilitator assistance. Target: at least 95% of participants.
2. SC-012 security management: after signing in to a prepared verified account, find Sessions and Security, identify/revoke another session, enroll or manage 2FA, and sign out. Success requires completion without facilitator assistance. Target: at least 90% of participants.

Use a maximum of 10 minutes per task. A participant may correct their own mistakes. A facilitator hint, test-data repair, abandonment, or timeout counts as unsuccessful for the threshold.

## Evidence capture

Record participant ID, device/viewport, assistive technology, task start/end, completion, assistance, observed error/recovery point, and optional qualitative comments. Do not record passwords, cookies, raw session references, verification/reset links, TOTP secrets/codes, or backup codes. Aggregate results in this file after review and delete any raw screen recording according to the study consent/retention policy.

## Result template

| Criterion | Participants | Unassisted successes | Rate | Threshold | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| SC-001 registration | Not run | Not run | Not run | >=95% | PENDING |
| SC-012 session/2FA management | Not run | Not run | Not run | >=90% | PENDING |

Do not mark T160 complete until both rows contain reviewed participant evidence and meet their thresholds.
