# Temporary npm Security Exception

- [x] npm audit was rerun without force-fixing dependencies.
- [x] Better Auth remains pinned to 1.6.11 for the approved compatibility baseline.
- [x] GHSA-86j7-9j95-vpqj affects Better Auth OIDC-provider and MCP redirect functionality.
- [x] SmartHire does not configure, import, expose, or route OIDC-provider or MCP functionality.
- [x] The application enables only email/password credentials and the approved TOTP plugin.
- [x] This exception must be reevaluated and Better Auth compatibility rerun before final release.

Reevaluated on 2026-07-21: `npm audit` reports 0 critical, 1 high, and 5 moderate findings. Repository and route scans again found no OIDC-provider or MCP import, configuration, or exposure. The accepted high finding remains isolated from the enabled email/password and TOTP runtime surface; the temporary exception remains in force and must be reevaluated before final release or any Better Auth pin change.
