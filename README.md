<div align="center">

# Retrieval-Augmented SaaS

**A multi-tenant platform for building AI chat assistants that answer from your own documents, with citations.**

Upload your PDFs, Word docs and web pages, organise them into knowledge bases, and chat with them. Every answer points back to the source it came from.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

[Features](#-features) · [Architecture](#-architecture) · [Getting started](#-getting-started) · [API](#-api-overview) · [Testing](#-testing) · [Roadmap](#-roadmap)

</div>

---

## Why this project exists

Most "chat with your docs" demos stop at a single user and a single PDF. Real teams need more than that: separate workspaces per company, roles and permissions, usage limits, audit trails, and answers they can actually trust.

This project is my attempt at building that properly. It's a full SaaS backbone for retrieval-augmented generation (RAG): tenant isolation enforced in the database itself, a background ingestion pipeline, hybrid search, grounded and cited answers, and a tool-using agent, all behind a clean dashboard.

## ✨ Features

**Knowledge & ingestion**
- 📄 Upload **PDF, DOCX, HTML, Markdown and plain text** (up to 25 MB per file)
- ⚙️ Background ingestion with **BullMQ + Redis**: parse → normalise → chunk → embed, with retry for failed documents
- 🧩 Structure-aware chunking that respects pages and sections instead of cutting text blindly

**Retrieval & answers**
- 🔎 **Hybrid search** that merges vector similarity and keyword search with Reciprocal Rank Fusion
- 📌 **Cited answers**: every response links back to the chunks it was built from
- 🛡️ **Grounding validation** to catch answers that drift away from the retrieved context
- ⚡ **Streaming responses** for a fast, chat-like feel

**Agents**
- 🤖 A step-limited **agent orchestrator** with a pluggable tool registry (ships with `rag_search` and `calculator`)

**SaaS essentials**
- 🏢 **Multi-tenant by design**, with isolation enforced by **PostgreSQL Row-Level Security**, not just app code
- 👥 Organisations, team members and roles: `OWNER`, `ADMIN`, `MEMBER`
- 🔑 JWT auth with refresh tokens, plus organisation-scoped **API keys**
- 💳 Subscription tiers (`FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`) with quota checks
- 💰 **Cost guard** that caps tokens, per-request spend and agent steps before a call goes out
- 📜 Audit logs, analytics overview, rate limiting and correlation IDs on every request
- ❤️ `/live`, `/ready` and `/health` endpoints, ready for container orchestration

## 🏗 Architecture

```mermaid
flowchart LR
    U[User] --> FE[Next.js dashboard<br/>:3000]
    FE -- /api/v1/* --> API[Express API<br/>:4000]
    API --> PG[(PostgreSQL<br/>+ pgvector + RLS)]
    API -- enqueue --> R[(Redis)]
    R --> W[Ingestion worker]
    W --> PG
    W --> S[(File storage)]
    API --> RAG[RAG orchestrator]
    RAG --> HR[Hybrid retriever<br/>vector + keyword]
    HR --> PG
    RAG --> LLM[Groq LLM<br/>gpt-oss-120b]
    W --> EMB[Local embeddings<br/>all-MiniLM-L6-v2]
```

**How a question gets answered:**
1. The **hybrid retriever** pulls candidate chunks using both vector and keyword search, then fuses the rankings.
2. The **context selector** picks the best chunks that fit the token budget.
3. The **LLM** writes an answer from that context, streamed back to the user.
4. The **grounding validator** and **citation resolver** check the answer and attach its sources.

## 🧰 Tech stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express 5, TypeScript |
| Data | PostgreSQL with pgvector and Row-Level Security |
| Queue | Redis + BullMQ |
| Parsing | pdf-parse, mammoth, cheerio, turndown |
| Observability | Pino structured logs, OpenTelemetry, correlation IDs |
| Testing | Jest, Supertest |
| DevOps | Docker, Docker Compose, GitHub Actions |

## 📁 Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── modules/          # auth, organization, knowledge-base, document,
│   │   │                     # conversation, RAG, agent, analytics, audit, ...
│   │   ├── providers/        # pluggable LLM, embedding and storage providers
│   │   ├── workers/          # BullMQ ingestion queue + processor
│   │   ├── middleware/       # auth, quotas, rate limiting, correlation IDs
│   │   ├── db/migrations/    # SQL schema, RLS policies (run on startup)
│   │   └── evaluation/       # RAG evaluation harness + dataset
│   └── tests/                # unit, integration, security and load tests
├── frontend/
│   └── src/app/              # dashboard, chat, knowledge bases, agent builder,
│                             # API keys, team, audit, login/signup
├── docs/                     # disaster recovery runbook
├── docker-compose.yml
└── Dockerfile.worker
```

## 🚀 Getting started

### Option A: Docker (production-style stack)

You only need [Docker](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/VigneshEilik/Retrival-Agumented-Saas.git
cd Retrival-Agumented-Saas
cp .env.production.example .env.production   # fill in every value (secrets, CORS origin, Groq key)
docker compose --env-file .env.production up -d --build
```

That brings up PostgreSQL (with pgvector), Redis, the API, the ingestion worker and the frontend. On first boot the database creates a least-privilege `rag_app` role and the API applies the migrations. Open **http://localhost:3000** and create an account. For HTTPS, put a reverse proxy in front of the `frontend` service (see the [Deployment Manual](docs/deployment/09-deployment-and-devops-manual.md)).

### Option B: Run locally (best for development)

**Prerequisites**
- Node.js **20+**
- PostgreSQL **16+** (ideally with the [pgvector](https://github.com/pgvector/pgvector) extension)
- Redis **7+** (optional: without it, ingestion runs in-process and rate limiting falls back to memory)

**1. Create the database and the application role.** The app must connect as a normal role, because PostgreSQL superusers bypass Row-Level Security (tenant isolation):

```bash
createdb rag_saas_db
psql -d rag_saas_db -v app_role=rag_app -v app_password='choose-a-password' \
     -v owner_role=postgres -f backend/scripts/db/setup-app-role.sql
```

**2. Configure and start the backend**

```bash
cd backend
cp .env.example .env      # set DATABASE_URL (rag_app), MIGRATION_DATABASE_URL (owner), JWT secrets, GROQ_API_KEY
npm install
npm run dev
```

Migrations are versioned and run automatically on startup (or with `npm run migrate:dev`). You should see `Server running on port 4000`. The first upload or question downloads the local embedding model (~90 MB).

**3. Start the frontend** in a second terminal

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. Requests to `/api/v1/*` are proxied to the backend, so no extra CORS setup is needed.

### ⚙️ Environment variables

`backend/.env`

| Variable | Description | Example |
|---|---|---|
| `PORT` | API port | `4000` |
| `NODE_ENV` | Runtime environment | `development` |
| `DATABASE_URL` | Application role (no superuser, no BYPASSRLS) | `postgres://rag_app:CHANGE_ME@127.0.0.1:5432/rag_saas_db` |
| `MIGRATION_DATABASE_URL` | Schema owner, used only for migrations | `postgres://postgres:CHANGE_ME@127.0.0.1:5432/rag_saas_db` |
| `CORS_ORIGINS` | Allowed browser origins (required in production) | `http://localhost:3000` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Access-token signing secret (32+ chars) | *generate one* |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret | *generate one* |
| `JWT_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |
| `LOG_LEVEL` | Pino log level | `info` |
| `GROQ_API_KEY` | Groq key for answer generation ([get one](https://console.groq.com/keys)). Empty = mock LLM | `gsk_...` |
| `GROQ_MODEL` | Groq chat model | `openai/gpt-oss-120b` |
| `EMBEDDING_PROVIDER` | `local` = real semantic embeddings on your machine (no key needed) | `local` |
| `EMBEDDING_MODEL` | Local embedding model (downloaded on first run, ~90 MB) | `Xenova/all-MiniLM-L6-v2` |
| `RUN_INGESTION_WORKER` | Run the ingestion worker inside the API process | `true` |

Frontend (build time)

| Variable | Description | Example |
|---|---|---|
| `API_INTERNAL_URL` | Where the Next.js server proxies `/api/v1/*` | `http://localhost:4000` |

The complete reference is in the [Developer and Maintenance Guide](docs/development/11-developer-and-maintenance-guide.md).

> 💡 **Generate strong secrets** with:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> 🪟 **Windows tip:** use `127.0.0.1` instead of `localhost` in `DATABASE_URL` if you also have Postgres running in Docker. Otherwise Node may connect over IPv6 to the wrong instance.

## 🔌 API overview

All routes are prefixed with `/api/v1` and, apart from signup/login, expect `Authorization: Bearer <token>` or an API key (`x-api-key: sk_live_…`). Full reference: [API Documentation](docs/api/05-api-documentation.md).

| Area | Endpoints |
|---|---|
| **Auth** | `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| **Organisation** | `GET/PATCH /organizations` · `GET/POST /organizations/members` · `PATCH /organizations/members/:userId/role` · `DELETE /organizations/members/:userId` |
| **Knowledge bases** | `GET/POST /knowledge-bases` · `GET/DELETE /knowledge-bases/:id` |
| **Documents** | `POST/GET /knowledge-bases/:id/documents` · `GET/DELETE /documents/:id` · `POST /documents/:id/retry` |
| **Chat** | `POST/GET /conversations` · `GET /conversations/:id/messages` · `POST /conversations/:id/messages/stream` |
| **Agent** | `POST /agent/runs` · `GET /agent/runs/:id` · `GET /agent/tools` |
| **Admin** | `GET/POST /api-keys` · `DELETE /api-keys/:id` · `GET /audit-logs` · `GET /analytics/overview` |
| **Health** | `GET /live` · `GET /ready` · `GET /health` |

**Quick try**

```bash
curl -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Ada Lovelace","email":"ada@example.com","password":"Str0ng@Pass","orgName":"Analytical Engines"}'
```

## 🧪 Testing

```bash
cd backend
npm test                                                  # 59 tests, runs as the rag_app role
node scripts/smoke/e2e-smoke.mjs http://localhost:3000    # end-to-end with real models (A–P)
npm run build && node scripts/smoke/failure-scenarios.mjs # Redis/LLM/DB/embedding outages
```

The suite needs PostgreSQL running (Redis optional). It covers more than the happy path:

- **Auth, organisations and API keys:** core SaaS flows
- **Tenant isolation:** proves one organisation can never read another's data through RLS
- **Ingestion:** parsers, chunker and the full pipeline
- **RAG quality:** retriever behaviour, streaming with citations, and an evaluation run against a reference dataset
- **Security red team:** prompt-injection and abuse scenarios
- **Load benchmark:** basic throughput checks

CI runs the full build and test suite on every push and pull request to `main` and `develop` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## 🔒 Security notes

- Tenant data is isolated at the **database level** with Row-Level Security, so a missed `WHERE` clause can't leak data across organisations.
- Passwords are hashed with bcrypt, and access tokens are short-lived with rotating refresh tokens.
- Role checks guard every destructive endpoint.
- The cost guard and quotas protect against runaway LLM spend.
- **Before going to production:** replace every default secret, restrict CORS to your domain, and serve over HTTPS.

## 🗺 Roadmap

- [x] Real LLM (Groq) and real semantic embeddings (local model, no API key needed)
- [ ] More LLM providers (OpenAI / Anthropic) behind the same interface
- [x] Use conversation history for follow-up questions
- [x] API-key authentication for integrations
- [ ] Reranking and full-text (BM25) keyword search
- [ ] OCR for scanned PDFs
- [ ] S3-compatible object storage provider (local disk is used today)
- [ ] Website crawling as a knowledge source
- [ ] Billing integration for subscription tiers
- [ ] Embeddable chat widget for customer websites

## 🛟 Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE :::3000` or `:::4000` | Something is already on that port. Stop it, or run `npx kill-port 3000 4000` |
| `failed to connect to the docker API` | Docker Desktop isn't running. Start it and try again |
| `Redis server unavailable … fallback mode` | Redis isn't reachable. Start it with `docker compose up -d redis` |
| `vector extension not enabled` | Your Postgres lacks pgvector. The app still works: similarity is computed in Node instead, which is fine for small and medium knowledge bases. For large ones, use the `pgvector/pgvector` Docker image |
| Tenant isolation not enforced locally | Don't connect as the `postgres` superuser: superusers bypass Row-Level Security. Use a normal database role in `DATABASE_URL` |
| Login works via curl but not in the browser | Make sure the backend is running on port 4000, because the frontend proxies to it |

For backup, restore and rollback procedures, see the [Deployment and DevOps Manual](docs/deployment/09-deployment-and-devops-manual.md). The complete documentation set (12 documents, also as PDFs) is indexed in [docs/README.md](docs/README.md).

## 🤝 Contributing

Contributions, ideas and bug reports are genuinely welcome.

1. Fork the repo and create a branch: `git checkout -b feature/your-idea`
2. Make your change and add tests where it makes sense
3. Run `npm test` in `backend/`
4. Open a pull request explaining **what** changed and **why**

## 📄 License

No license has been chosen yet. Until one is added, all rights are reserved by the author. If you'd like to use this project, please open an issue.

---

<div align="center">

Built with ☕ and a lot of curiosity about making AI answers you can actually trust.

If this project helped you, consider giving it a ⭐

</div>
