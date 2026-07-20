# Software-Engineering---Group-9

```bash
Software-Engineering---Group-9/
│
├── .agents/
├── .github/
├── .vscode/
├── docs/
│   └── architecture/
│       └── decisions/
│
├── src/                                      # Spec Kit root, giữ nguyên
│   ├── .specify/
│   │   ├── feature.json
│   │   ├── memory/
│   │   │   └── constitution.md
│   │   └── scripts/
│   │
│   └── specs/
│       └── 001-identity-authentication-account-recovery/
│           ├── checklists/
│           ├── contracts/
│           ├── data-model.md
│           ├── plan.md
│           ├── quickstart.md
│           ├── research.md
│           ├── spec.md
│           └── tasks.md
│
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   ├── register/
│       │   │   │   ├── login/
│       │   │   │   ├── verify-email/
│       │   │   │   ├── forgot-password/
│       │   │   │   └── reset-password/
│       │   │   │
│       │   │   └── api/
│       │   │       └── auth/
│       │   │           ├── register/
│       │   │           ├── verify-email/
│       │   │           └── resend-verification/
│       │   │
│       │   ├── features/
│       │   │   └── authentication/
│       │   │       ├── components/
│       │   │       ├── hooks/
│       │   │       ├── schemas/
│       │   │       └── types/
│       │   │
│       │   ├── server/
│       │   │   ├── auth/
│       │   │   ├── email/
│       │   │   ├── repositories/
│       │   │   └── services/
│       │   │
│       │   ├── components/
│       │   │   └── ui/
│       │   ├── lib/
│       │   └── types/
│       │
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       │
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       │
│       ├── public/
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/
│   ├── setup-local.mjs
│   └── check-environment.mjs
│
├── .env.example
├── .gitignore
├── .node-version
├── .nvmrc
├── compose.yaml
├── package.json
├── package-lock.json
└── README.md
```
