# Platform Administrator Grant Runbook

Only an approved Operations operator may run the out-of-band provisioning command. The target account must be ACTIVE, email-verified, and have verified two-factor authentication. Record the change ticket, operator, target account reference, requested lifecycle action, result, and time in the operational audit system.

For bootstrap, provision two independently owned grants and verify both can complete administration sign-in before removing temporary access. Suspension, revocation, and expiry are direct database-controlled operations executed through approved operational tooling; they take effect on the next administration request. Never remove the last usable ACTIVE, unexpired grant. Confirm another grant and designated session before any lifecycle change that could create lockout.

This ordinary runbook defines no emergency recovery or break-glass procedure. Browser-based grant creation, invitation, role editing, and grant deletion remain prohibited.
