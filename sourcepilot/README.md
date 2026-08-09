# SourcePilot application

This package contains the Next.js application, procurement policy engine, Monad registry client, and Rain payment-adapter boundary.

Run commands from the repository root:

```bash
pnpm install
CHAIN_ID=10143 pnpm dev
pnpm test
pnpm build
```

Routes:

- `/compare` — supplier comparison and sourcing constraints
- `/approve` — mandate and approval workflow
- `/api/mandate` — register a signed procurement mandate
- `/api/pay` — enforce the mandate before payment execution

Secrets belong only in `.env.secrets.local`, which is ignored by Git. Use `.env.secrets.local.example` as the variable-name reference.
