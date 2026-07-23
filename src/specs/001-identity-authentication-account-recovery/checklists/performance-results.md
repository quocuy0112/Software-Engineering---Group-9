# Page performance results

Recorded on 2026-07-22 with the reproducible `npm run perf:pages --workspace @smarthire/web` harness.

## Environment and method

- Windows development workstation; Node.js 24.18.x; Next.js 16.2.9 development server.
- Headless Chromium from Playwright 1.57.0 at 1280 x 720 with reduced motion.
- Local PostgreSQL 16.12 Compose service on `127.0.0.1:55432`.
- Local capture email adapter; no SMTP or Resend network delivery.
- One warm-up navigation followed by 100 serial warm navigations per public identity route.
- Timing starts immediately before `page.goto` and ends at `DOMContentLoaded`. The server and browser are local, and no production-CDN claim is made.

| Route | Runs | p50 | p95 | Maximum | 3 s gate |
| --- | ---: | ---: | ---: | ---: | --- |
| `/register` | 100 | 167.27 ms | 208.74 ms | 230.96 ms | PASS |
| `/login` | 100 | 172.48 ms | 214.82 ms | 258.83 ms | PASS |
| `/forgot-password` | 100 | 187.85 ms | 230.69 ms | 262.20 ms | PASS |
| `/reset-password` | 100 | 208.35 ms | 251.98 ms | 286.72 ms | PASS |
| `/verify-email` | 100 | 236.57 ms | 334.13 ms | 419.09 ms | PASS |
| `/check-email` | 100 | 313.92 ms | 411.12 ms | 453.60 ms | PASS |
| `/two-factor` | 100 | 295.91 ms | 377.09 ms | 537.19 ms | PASS |

All measured p95 page loads are below the 3-second target. Identity action latency remains covered separately by controlled integration and Playwright workflow assertions; provider delivery is intentionally outside request latency because requests return after the outbox commit.
