# VedaAI

> AI-powered question paper generator — describe what you want, attach a syllabus PDF, and get a sectioned, exam-ready paper with an answer key and downloadable PDF.

Built originally for **Delhi Public School, Sector-4, Bokaro**.

---

## Architecture

VedaAI is a **decoupled, queue-driven full-stack system** with four moving parts: a Next.js frontend, an Express API, two BullMQ-backed workers, and a Socket.IO event bus tying it all together. The browser talks to the API over HTTP (mutations) and Socket.IO (live progress); the API persists to MongoDB, enqueues jobs onto Redis-backed BullMQ queues, and the workers pop those jobs, call the Groq LLM / render PDFs, and emit results back to the per-job Socket.IO room.

### System diagram

```
                         ┌─────────────────────────────────┐
                         │           Browser               │
                         │   Next.js 16 + React 19 + TS    │
                         │   Zustand stores · Sonner       │
                         └─────────┬────────────┬──────────┘
                                   │            │
                            HTTP (axios)    WebSocket (socket.io-client)
                                   │            │
                                   ▼            ▼
                         ┌─────────────────────────────────┐
                         │        Express 5 + TS API       │
                         │   /api/assignments  /api/upload │
                         │       Socket.IO server          │
                         └───┬───────────────┬────────────┬┘
                             │               │            │
                  Mongoose ops│   BullMQ enqueue          │CORS+JSON
                             ▼               ▼            │
                      ┌──────────────┐  ┌──────────────┐  │
                      │ MongoDB      │  │ Redis        │  │
                      │ Atlas        │  │ (Upstash)    │  │
                      │              │  │              │  │
                      │ Assignment   │  │ - BullMQ     │  │
                      │ documents    │  │   queues     │  │
                      │ (incl. PDF   │  │ - List cache │  │
                      │  buffer)     │  │   (TTL 60s)  │  │
                      └──────▲───────┘  └──────┬───────┘  │
                             │                 │          │
                             │  read/write     │ pop job  │
                             │                 ▼          │
                      ┌──────┴───────────────────────────┐│
                      │           Workers                ││
                      │  ┌─────────────┐ ┌─────────────┐ ││
                      │  │ generation  │ │ pdfWorker   │ ││
                      │  │ Worker      │ │             │ ││
                      │  │   Groq LLM  │ │  PDFKit     │ ││
                      │  └──────┬──────┘ └──────┬──────┘ ││
                      └─────────┼───────────────┼────────┘│
                                │               │         │
                                └───┬───────────┘         │
                                    │ io.to(room).emit    │
                                    └─────────────────────┘
                                          (job:progress,
                                           job:complete,
                                           pdf:complete, …)
```

### Sequence — creating a paper

```
Browser            API              Mongo     Redis (BullMQ)      Worker         Groq
   │ POST /assignments │                │             │                │              │
   │──────────────────▶│                │             │                │              │
   │                   │ insert pending │             │                │              │
   │                   │───────────────▶│             │                │              │
   │                   │ add(generate)  │             │                │              │
   │                   │──────────────────────────────▶│                │              │
   │  202 {jobId}      │                │             │                │              │
   │◀──────────────────│                │             │                │              │
   │                   │                │             │  consume        │              │
   │                   │                │             │───────────────▶│              │
   │                   │                │ status=proc │                │              │
   │  emit job:progress (15..90) over Socket.IO rooms                  │              │
   │◀──────────────────────────────────────────────────│ ───────────── │              │
   │                                                                    │ generate     │
   │                                                                    │─────────────▶│
   │                                                                    │◀─── JSON ────│
   │                                                  status=completed  │              │
   │                                                  generatedPaper    │              │
   │  emit job:complete with paper                                      │              │
   │◀──────────────────────────────────────────────────────────────────│              │
```

### Sequence — downloading the PDF

```
Browser              API           Mongo     Redis(BullMQ)      pdfWorker
   │ POST /assignments/:id/pdf │       │            │                  │
   │──────────────────────────▶│       │            │                  │
   │                           │ check pdfStatus    │                  │
   │                           │──────▶│            │                  │
   │  if cached: 200 {cached:true}     │            │                  │
   │◀──────────────────────────│       │            │                  │
   │                           │ add(render)        │                  │
   │                           │────────────────────▶                  │
   │ 202 {pdfJobId}            │                    │                  │
   │◀──────────────────────────│                    │ consume          │
   │                           │                    │─────────────────▶│
   │                           │   status=processing                   │
   │ emit pdf:progress         │◀───────────────────────────────────── │
   │◀──────────────────────────│                                       │
   │                           │   PDFKit render → Buffer              │
   │                           │   save buffer + status=completed      │
   │ emit pdf:complete         │◀───────────────────────────────────── │
   │◀──────────────────────────│                                       │
   │ auto-trigger anchor click  → GET /assignments/:id/pdf             │
   │──────────────────────────▶│ stream pdfBuffer with attachment      │
```

### Layers (in brief)

- **Frontend — `frontend/`** — Next.js 16 / React 19 / Tailwind 4. Three routes (`/assignments`, `/assignments/new`, `/assignments/[id]`), Zustand stores, Sonner toasts, a per-`jobId` Socket.IO singleton, and a typed axios client.
- **API — `backend/src/`** — Express 5 with `routes/assignments.ts` (CRUD, regenerate, PDF) and `routes/upload.ts` (`multer` + `pdfjs-dist` text extraction). Zod validation at the edge, CORS locked to `FRONTEND_URL`, Socket.IO per-job rooms, `/health`.
- **Persistence** — MongoDB `Assignment` docs (form inputs, generation + PDF state machines, generated paper, cached PDF buffer for O(1) re-downloads) and Redis (BullMQ queues + a 60 s `assignments:list` cache invalidated on every mutation).
- **Workers — `backend/src/workers/`** — `generationWorker.ts` (Groq LLM → Zod → `job:complete`) and `pdfWorker.ts` (PDFKit → stored `Buffer` → `pdf:complete`); booted in-process for dev but splittable into separate dynos.

### Why each piece exists

| Concern | Choice |
| --- | --- |
| LLM calls take 5–15 s | BullMQ queue + worker — don't block the request thread; get retries and horizontal scaling. |
| Users want a progress bar | Socket.IO rooms per `jobId` — targeted stage labels, no polling or broadcast noise. |
| Repeated list fetches | Redis 60 s cache with explicit invalidation — fresh, but doesn't hammer Mongo. |
| LLM output is text, schema is sacred | Zod on both sides — reject bad forms and bad LLM JSON before they hit the DB. |
| PDFs must look identical | Server-side PDFKit — deterministic output, cached buffer for instant re-download. |
| API and worker share types | Single `tsx` codebase — one queue-payload definition for producer and consumer. |

---

## Approach

The product question: *let a teacher describe an exam in plain language and a few numbers, and produce a paper they'd actually print.* The engineering choices follow from it.

1. **LLM call is an async job, not an HTTP handler.** The API validates with Zod, inserts a `pending` doc, enqueues the job, and returns `202 {jobId}`. Reliability is free: BullMQ retries with backoff; failures surface as `status: "failed"` + a socket event.

2. **LLM output is non-negotiable.** A JSON-only system message, Groq `response_format: json_object`, per-type prompt guidance (`TYPE_GUIDANCE` in `services/llm.ts`), a guarded `JSON.parse`, and a final Zod pass (`PaperSchema`). Only validated values are stored, and the same types are shared with the frontend.

3. **State machines, not booleans.** Two lifecycles per assignment — generation (`pending → processing → completed | failed`) and PDF (`none → pending → processing → completed | failed`) — stored as discrete enums. The detail page is a switch on `assignment.status`; the PDF status drives the download button label.

4. **Right channel per update.** Mutations go over HTTP (user-initiated, 2xx/4xx). Progress goes over Socket.IO to `io.to('job:' + jobId)` so each teacher sees only their own job. A 3 s polling loop is a fallback if the socket drops.

5. **Cache only what's safe to be 60 s stale.** Only the list view is cached; single-doc reads never are (the detail page polls during generation). The PDF buffer lives in Mongo, not Redis.

6. **Server-renders PDFs, client-renders previews.** HTML preview on `/assignments/[id]`; PDF export via PDFKit (`services/pdfRenderer.ts`) with explicit fonts, colors, and page-break checks. `html2pdf.js` exists only as a fallback.

7. **Keep the form honest.** Client-side and server-side validation share the same Zod schema. The question-type matrix updates `totalQuestions`/`totalMarks` live.

8. **Mobile-first UI.** Shared components with Tailwind `md:` breakpoints, a floating "Create Assignment" pill, and a CSS-gradient brand mark (no logo asset).

---

## Bonus

**1. Beautified notifications.** Every message flows through **Sonner** (`<Toaster position="top-right" richColors closeButton />`) instead of `alert()`/`confirm()`. The interesting bit: confirmation dialogs (Delete, Regenerate) are wrapped as awaitable `Promise<boolean>`, giving `async/await` ergonomics with a styled, non-blocking dialog where every dismissal path resolves to `false`.

**2. Real Regenerate.** Rather than creating a duplicate assignment, `POST /api/assignments/:id/regenerate` reuses the same document and resets **both** lifecycle state machines in lockstep (`status`, `generatedPaper`, and the entire PDF lifecycle), re-enqueues on the same production pipeline, and invalidates the cache. The frontend confirms via the Sonner promise, wires the new `jobId` into Zustand + Socket.IO, and optimistically flips the UI to the generating state — instant feel, clean failure recovery, no half-updated DB.
