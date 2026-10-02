<div align="center">

# 🧠 VectorMind-AI

### Production Full-Stack Retrieval-Augmented Generation (RAG) Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-lightgrey?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)](https://neon.tech/)
[![pgvector](https://img.shields.io/badge/pgvector-HNSW-green)](https://github.com/pgvector/pgvector)
[![Google Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-orange?logo=google)](https://ai.google.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)

A production-grade, enterprise-ready full-stack AI knowledge platform featuring decoupled client/server architecture, PostgreSQL + `pgvector` HNSW vector indexing, multi-tenant data isolation, grounded citation tracking, and multi-turn conversational memory.

[Key Features](#-key-features) •
[Architecture](#-architecture) •
[Tech Stack](#-tech-stack) •
[Quick Start](#-quick-start) •
[API Reference](#-api-reference) •
[Verification Suites](#-testing--verification)

</div>

---

## 🌟 Key Features

- **Decoupled Architecture:** Modern Next.js 15 App Router frontend paired with a standalone Node.js/Express TypeScript backend with dedicated domain services.
- **High-Performance Vector Search:** 768-dimensional embeddings generated with Google's `text-embedding-004`, indexed with `pgvector` using an optimized HNSW index (`m = 16`, `ef_construction = 64`) for sub-millisecond approximate nearest neighbor (ANN) retrieval.
- **Multi-Tenant Vector & Resource Isolation:** Strict tenant boundaries enforced at the SQL database layer. Vector similarity queries and document retrievals are scoped to the authenticated user, preventing cross-tenant leakage.
- **Intelligent Ingestion Pipeline:** Multi-format document parsing (`.txt`, `.pdf`) supporting semantic paragraph chunking and fixed-size chunking with page number tracking and transactional idempotency.
- **Grounded RAG with Persistent Citations:** Real-time generation powered by Gemini 2.5 Flash. Every response is strictly grounded in retrieved document chunks with citation metadata (title, file, page, chunk index, cosine similarity score) stored directly in PostgreSQL JSONB for reliable replay without repeated vector queries.
- **Conversational Memory:** Multi-turn conversational context injection bounded to recent conversation turns to preserve follow-up comprehension while avoiding context degradation.
- **Enterprise Security & Validation:** Password hashing via `bcryptjs` (cost factor 12), JWT Bearer session tokens, runtime request validation with Zod schemas, and standardized HTTP error handling.

---

## 🏛️ Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend (Next.js 15)"]
        UI[RAG Studio UI]
        AuthCtx[Auth Context & JWT]
        APIClient[Unified API Client]
        UI --> AuthCtx
        AuthCtx --> APIClient
    end

    subgraph Server["Backend API (Express + TypeScript)"]
        Router["/api/v1 Routes"]
        AuthMdw["requireAuth / optionalAuth"]
        ValidateMdw["Zod Validation"]
        
        APIClient -->|Bearer Token + JSON/Multipart| Router
        Router --> AuthMdw --> ValidateMdw

        DocCtrl[Document Controller]
        SearchCtrl[Search Controller]
        ChatCtrl[Chat Controller]
        ConvCtrl[Conversation Controller]

        ValidateMdw --> DocCtrl
        ValidateMdw --> SearchCtrl
        ValidateMdw --> ChatCtrl
        ValidateMdw --> ConvCtrl
    end

    subgraph AIServices["AI & Ingestion Layer"]
        Extractor[Extraction Service]
        Chunker[Chunking Service]
        Embedder[Gemini Embeddings]
        RAG[RAG Service - Gemini 2.5]
        
        DocCtrl --> Extractor --> Chunker --> Embedder
        SearchCtrl --> Embedder
        ChatCtrl --> RAG
    end

    subgraph Database["PostgreSQL / Neon DB + pgvector"]
        Users[(Users)]
        Docs[(Documents)]
        Chunks[(Document Chunks + HNSW Index)]
        Convs[(Conversations)]
        Msgs[(Messages + Citations JSONB)]
        
        Embedder -->|Upsert Chunks| Chunks
        RAG -->|Cosine Sim Query (User-Scoped)| Chunks
        RAG -->|Persist Turn & Citations| Msgs
    end
```

---

## 💻 Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15, React 19, TailwindCSS, Radix UI, Lucide | Responsive, modern dark/light mode interface & RAG Studio |
| **Backend** | Express 4, Node.js 20+, TypeScript 5.7 | Robust, high-throughput REST API with clean domain controllers |
| **Database** | PostgreSQL 16 (Neon Serverless), Prisma ORM 5.22 | Relational models, connection pooling, and automated migrations |
| **Vector Engine** | `pgvector` with HNSW cosine distance indexing | 768-dimensional approximate nearest neighbor vector indexing |
| **AI / Embeddings** | `@ai-sdk/google`, Google Gemini 2.5 Flash, `text-embedding-004` | High-quality text embeddings & grounded conversational generation |
| **Security** | `bcryptjs`, `jsonwebtoken` (JWT), `zod` | Encrypted passwords, Bearer tokens, strict request validation |
| **Background Processing** | Inngest (integrated event dispatch & local fallback) | Scalable background document extraction & embedding pipelines |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` (`npm install -g pnpm`)
- **PostgreSQL / Neon Account**: With the `vector` extension enabled
- **Google Gemini API Key**: Free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/Sagenmurmu/VectorMind-AI.git
cd VectorMind-AI

# Install all workspace dependencies
pnpm install
```

---

### 3. Environment Variables Setup

Create `.env` in the root workspace:

```env
# Frontend Client Configuration
NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"

# Database Configuration (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-sample.region.aws.neon.tech/neondb?sslmode=require"

# Google AI Keys
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
```

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Google AI Keys
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"

# Database Configuration
DATABASE_URL="postgresql://user:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-sample.region.aws.neon.tech/neondb?sslmode=require"
```

---

### 4. Database Migrations

Apply the authoritative Prisma migrations to Neon PostgreSQL:

```bash
# Push migrations and generate client
pnpm prisma migrate deploy
pnpm prisma generate
```

---

### 5. Running the Application

Run both frontend and backend concurrently in separate terminal sessions:

```bash
# Terminal 1: Start Express Backend (Port 5000)
pnpm dev:backend

# Terminal 2: Start Next.js Frontend (Port 3000)
pnpm dev
```

Visit **`http://localhost:3000`** in your browser to start using VectorMind.

---

## 📡 API Reference

Base URL: `http://localhost:5000/api/v1`

### Authentication (`/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/register` | Register new user account with hashed password | No |
| `POST` | `/auth/login` | Authenticate user & issue signed JWT | No |
| `GET` | `/auth/me` | Fetch authenticated profile details | Bearer Token |

### Documents (`/documents`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/documents/upload` | Upload `.txt`/`.pdf` & extract/chunk/embed (`?sync=true`) | Optional (Scoped) |
| `GET` | `/documents` | List user's documents with chunk counts | Optional (Scoped) |
| `GET` | `/documents/:id` | Get document details and chunk statistics | Optional (Scoped) |
| `DELETE`| `/documents/:id` | Cascade delete document and all vector chunks | Optional (Scoped) |

### Semantic Search (`/search`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/search` | Cosine similarity vector search over chunks | Optional (Scoped) |

### RAG & Conversations (`/chat`, `/conversations`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/chat` | Grounded RAG Q&A with multi-turn memory & citations | Optional (Scoped) |
| `GET` | `/conversations` | List user's conversation threads | Bearer Token |
| `POST` | `/conversations` | Create a new conversation thread | Bearer Token |
| `GET` | `/conversations/:id`| Load conversation messages and persisted citations | Bearer Token |
| `PATCH`| `/conversations/:id`| Update conversation title | Bearer Token |
| `DELETE`| `/conversations/:id`| Delete conversation thread and messages | Bearer Token |

---

## 🧪 Testing & Verification

VectorMind includes comprehensive automated test suites to verify database sanity, vector search accuracy, and multi-tenant security isolation:

```bash
# Run Database & pgvector sanity verification (Phase 2)
pnpm test:db

# Run Document Ingestion, Chunking & RAG pipeline verification (Phase 3)
pnpm test:phase3

# Run End-to-End Multi-Tenant Isolation & Product Security test suite (Phase 4)
pnpm test:phase4
```

### What `pnpm test:phase4` Verifies:
1. User A and User B registration & password hashing.
2. JWT issuance and `/auth/me` token authentication.
3. User A synchronous document upload and vector chunk embedding.
4. **Document Isolation:** User B cannot view User A's documents.
5. **Authorization Guards:** User B receives `403 Forbidden` attempting to access or delete User A's document.
6. User A conversation creation & grounded RAG response generation.
7. **Citation Persistence:** Citations verified in PostgreSQL JSONB with accurate document metadata and similarity metrics.
8. **Multi-Turn Recall:** Follow-up questions correctly resolve context from previous conversation turns.
9. **Vector Query Isolation:** User B's RAG queries return zero chunks from User A's private documents.

---

## 📂 Repository Structure

```
VectorMind-AI/
├── backend/                        # Node.js + Express.js TypeScript Backend
│   ├── prisma/
│   │   ├── migrations/             # Authoritative database migrations
│   │   └── schema.prisma           # Prisma Schema (Users, Docs, Chunks, Convs, Msgs)
│   ├── src/
│   │   ├── config/                 # Environment & server configuration
│   │   ├── controllers/            # Request handlers (auth, doc, chat, search, conv)
│   │   ├── db/                     # Prisma singleton client instance
│   │   ├── middleware/             # requireAuth, optionalAuth, validateBody, errorHandler
│   │   ├── routes/                 # Express API v1 route definitions
│   │   ├── schemas/                # Zod request validation schemas
│   │   ├── scripts/                # Automated verification suites
│   │   ├── services/               # Core domain services (AI, Auth, Document, Conversation)
│   │   ├── app.ts                  # Express application factory & middleware setup
│   │   └── server.ts               # HTTP Server entrypoint
│   └── package.json
│
├── src/                            # Next.js 15 Frontend
│   ├── app/                        # Next.js App Router (pages & layouts)
│   │   ├── (chat)/chat/page.tsx    # RAG Studio Playground
│   │   ├── api/                    # Deprecated legacy route proxies
│   │   ├── layout.tsx              # Root layout with AuthProvider & ThemeProvider
│   │   └── page.tsx                # Landing page
│   ├── components/                 # Reusable UI components
│   │   ├── auth-modal.tsx          # Login & Registration modal
│   │   ├── navbar.tsx              # Navigation bar with user status
│   │   ├── tabs/                   # IngestTab, SearchTab, ChatTab
│   │   └── ui/                     # Accessible UI component library
│   └── lib/
│       ├── api/client.ts           # Centralized Express API client
│       └── auth/auth-context.tsx   # React Auth Context & session management
│
├── package.json                    # Root workspace orchestration scripts
└── README.md
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run Next.js frontend development server (`localhost:3000`) |
| `pnpm dev:backend` | Run Express backend development server with watch mode (`localhost:5000`) |
| `pnpm build` | Build optimized Next.js frontend production bundle |
| `pnpm build:backend` | Compile backend TypeScript code into `dist/` |
| `pnpm test:phase4` | Execute end-to-end multi-tenant product test suite |
| `pnpm test:phase3` | Execute AI & RAG ingestion test suite |
| `pnpm test:db` | Execute database and pgvector sanity check |
| `pnpm prisma migrate deploy` | Apply pending database migrations to PostgreSQL |

---

## 📄 License

This project is licensed under the MIT License.
