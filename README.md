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
    RAG --> LLM[LLM provider]
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

### Option A: Docker (quickest)

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/VigneshEilik/Retrival-Agumented-Saas.git
cd Retrival-Agumented-Saas
docker compose up --build
```

That brings up PostgreSQL (with pgvector), Redis, the API, the ingestion worker and the frontend. Open **http://localhost:3000** and create an account.

### Option B: Run locally (best for development)

**Prerequisites**
- Node.js **20+**
- PostgreSQL **16+** (ideally with the [pgvector](https://github.com/pgvector/pgvector) extension)
- Redis **7+** (optional: without it, the app runs in a fallback mode with no background queue or rate limiting)

**1. Start Postgres and Redis.** Use your own installs, or let Docker run just these two:

```bash
docker compose up -d postgres redis
```

**2. Configure and start the backend**

```bash
cd backend
cp .env.example .env      # then adjust the values (see below)
npm install
npm run dev
```

Database migrations run automatically on startup. You should see `Server running on port 4000`.

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
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgrespassword@127.0.0.1:5432/rag_saas_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Access-token signing secret (32+ chars) | *generate one* |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret | *generate one* |
| `JWT_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |
| `LOG_LEVEL` | Pino log level | `info` |

`frontend/.env`

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:4000` |

> 💡 **Generate strong secrets** with:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> 🪟 **Windows tip:** use `127.0.0.1` instead of `localhost` in `DATABASE_URL` if you also have Postgres running in Docker. Otherwise Node may connect over IPv6 to the wrong instance.

## 🔌 API overview

All routes are prefixed with `/api/v1` and, apart from signup/login, expect `Authorization: Bearer <token>`.

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
npm test
```

The suite needs PostgreSQL and Redis running. It covers more than the happy path:

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

- [ ] Plug in real LLM and embedding providers (OpenAI / Anthropic / local models). **Mock providers are used today**, so the full pipeline runs without API keys.
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
| `vector extension not enabled` | Your Postgres lacks pgvector. The app still runs, but vector search is disabled. Use the `pgvector/pgvector` Docker image to enable it |
| Login works via curl but not in the browser | Make sure the backend is running on port 4000, because the frontend proxies to it |

For backup and restore procedures, see the [disaster recovery runbook](docs/disaster_recovery.md).

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
