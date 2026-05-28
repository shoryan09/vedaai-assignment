# VedaAI

> AI-powered question paper generator — describe what you want, attach a syllabus PDF, and get a sectioned, exam-ready paper with an answer key and downloadable PDF.

Built originally for **Delhi Public School, Sector-4, Bokaro**.

---

## Table of Contents

- [Architecture](#architecture)
- [Approach](#approach)
- [Bonus](#bonus)

---

## Architecture

VedaAI is a **decoupled, queue-driven full-stack system** with four moving parts: a Next.js frontend, an Express API, two BullMQ-backed workers, and a Socket.IO event bus tying it all together.

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

### Layered breakdown

**1. Presentation layer — `frontend/`**
- **Next.js 16 App Router**, React 19, Tailwind 4.
- Three routes:
  - `/assignments` — list with search and Redis-cached fetch.
  - `/assignments/new` — multi-section form (title, class, due date, reference upload, question-type matrix, additional instructions).
  - `/assignments/[id]` — detail page that hosts three visual states (generating → completed → failed) selected by `assignment.status`.
- **Zustand** for client state — separated into `assignmentStore` (generation progress, stage label, current job ID) and `uiStore` (mobile nav open).
- **Sonner** for every notification: success, error, and **promise-based confirmation dialogs** (see [Bonus](#bonus)).
- A single **Socket.IO singleton** in `lib/socket.ts` reused across pages; subscriptions are scoped to a specific `jobId` so a browser only receives events for the paper it is watching.
- **Axios** client in `lib/api.ts` exposes typed wrappers over every backend endpoint.

**2. API layer — `backend/src/index.ts` + `routes/`**
- **Express 5** with two routers:
  - `routes/assignments.ts` — CRUD, regenerate, PDF request, PDF download.
  - `routes/upload.ts` — `multer` in-memory upload + server-side PDF text extraction via `pdfjs-dist`.
- **Validation at the edge** using Zod (`createSchema` in `assignments.ts`) — bad payloads never reach the queue.
- **CORS** locked to `FRONTEND_URL`.
- **Socket.IO** server attached to the same HTTP server. Two `socket.on` handlers (`subscribe`, `subscribePdf`) let clients join per-job rooms; the workers later target those rooms with `io.to(room).emit(...)`.
- A `/health` endpoint for liveness probes.

**3. Persistence layer — MongoDB + Redis**
- **MongoDB** stores `Assignment` documents (`models/Assignment.ts`):
  - Form inputs (title, class, due date, question types, instructions, reference text).
  - Generation state machine: `status: pending | processing | completed | failed`.
  - The generated paper itself (`sections[]`, `answerKey`, `totalMarks`, `totalQuestions`).
  - **PDF lifecycle** as a sibling state machine: `pdfStatus`, `pdfJobId`, `pdfBuffer` (raw `Buffer`), `pdfGeneratedAt`. Storing the buffer in MongoDB means re-downloads are O(1) — no re-render.
- **Redis** plays two roles:
  - **BullMQ backend** for queues `question-generation` and `pdf-generation`. Both configured with `attempts: 2`, exponential backoff, and `removeOnComplete/Fail: { count: 50 }`.
  - **Read-through cache** at key `assignments:list` with a 60-second TTL. Every mutation (`POST`, `DELETE`, `regenerate`) explicitly invalidates it with `redisConnection.del(...)`.

**4. Worker layer — `backend/src/workers/`**
- Both workers are booted **in-process** from `index.ts` (`await import("./workers/generationWorker")` and `startPdfWorker()`), but they are designed to be split into separate dynos by running `npm run worker` and a standalone PDF worker — the only reason they live together right now is dev simplicity.
- `generationWorker.ts` flips the document to `processing`, emits four progress events, calls the LLM, validates with Zod, writes the paper, and emits `job:complete`.
- `pdfWorker.ts` consumes the assignment, hands it to `services/pdfRenderer.ts`, stores the `Buffer`, and emits `pdf:complete` with a `downloadUrl`.

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

### Why each piece exists

| Concern | Choice | Why |
| --- | --- | --- |
| LLM calls take 5–15 s | **BullMQ queue + worker** | Don't block the HTTP request thread; gives retries, backoff, and an obvious place to scale horizontally later. |
| Users want a progress bar | **Socket.IO rooms per `jobId`** | Worker emits stage labels (`Building structured prompt…`, `Calling AI model…`, etc.) directly to the one browser that cares — no polling, no broadcast noise. |
| Repeated list fetches | **Redis 60 s cache with explicit invalidation** | A teacher refreshing the list page shouldn't hammer Mongo; mutations bust the key so freshness is never wrong. |
| LLM output is text, schema is sacred | **Zod schemas on both sides** | Frontend rejects bad forms before they leave the browser; backend rejects bad LLM JSON before it touches the DB. |
| PDFs must look identical for every teacher | **Server-side PDFKit, not html2pdf** | Deterministic output, no font/CSS drift across browsers, and the rendered buffer is cached in Mongo so a second download is instant. |
| API and worker share types | **Single `tsx` codebase under `backend/src/`** | One queue payload definition (`GenerationJobData`, `PdfJobData`) used by both producer and consumer — no duplicated interfaces. |

---

## Approach

The product question was simple: *let a teacher describe an exam in plain language and a few numbers, and produce a paper they'd actually print.* The engineering choices fall out of that.

### 1. Treat the LLM call as an async job, not an HTTP handler

The first instinct is to call Groq inside the `POST /assignments` handler and return the paper. Three problems:

- A 5–15 second hold on an Express worker is wasteful and brittle.
- A network blip mid-call leaves the client with no recovery path.
- There is no clean way to surface progress.

So the API does **only** what it can do quickly: validate input with Zod, insert a `pending` document, push a `GenerationJobData` payload onto the `question-generation` queue, and return `202 Accepted` with the `jobId`. Everything else happens in the worker. Reliability comes for free: BullMQ retries twice with exponential backoff (`delay: 3000`), and failed jobs surface as `status: "failed"` plus a socket event.

### 2. Make the LLM output non-negotiable

LLM JSON drifts. Markdown fences, hallucinated keys, missing fields — all common. The defense is layered:

- **System message** pins the response format: *"You are a JSON-only assistant. Respond with valid JSON matching the requested schema. No markdown, no code fences, no extra text."*
- **`response_format: { type: "json_object" }`** is set on the Groq call.
- **Per-type prompt guidance** in `TYPE_GUIDANCE` (in `services/llm.ts`) writes the formatting rules into the user message — e.g. MCQ options must be on separate lines, numerical questions must contain concrete numbers and units, diagram questions must explicitly require drawing.
- **`JSON.parse`** is wrapped in a try/catch with a descriptive error message that includes the first 200 chars of the response.
- **Zod** (`PaperSchema`) is then run over the parsed object. Only the validated value is stored.

The same Zod-mirrored types are exported to the frontend via `frontend/src/types/index.ts`, so the rendering code can assume the shape.

### 3. State machines, not booleans

There are two intertwined lifecycles per assignment:

- **Generation:** `pending → processing → completed | failed`
- **PDF:** `none → pending → processing → completed | failed`

They are stored as discrete enum fields (`status`, `pdfStatus`) on the same Mongoose document. The detail page (`/assignments/[id]`) is a giant switch on `assignment.status`:

- `pending | processing` → `<GeneratingState />` with progress bar and live stage label.
- `failed` → CTA back to the create form.
- `completed` → the full rendered paper with download and regenerate buttons.

The PDF status drives the **Download as PDF** button label (`Queueing… → Generating PDF… → Download as PDF`). Decoupling the two states meant the regenerate flow could reset *both* cleanly (see [Bonus](#bonus)).

### 4. Use the right channel for the right update

- **Mutations** go over HTTP. They are user-initiated, expect a response, and need standard 2xx/4xx semantics.
- **Progress** goes over Socket.IO. It is server-initiated, fire-and-forget, and needs to fan out to a specific browser.

The worker doesn't broadcast — it emits to `io.to('job:' + jobId)`. The browser joined that room when it received the `jobId` from the `POST` response. This means three teachers creating papers simultaneously each see only their own progress.

A fallback polling loop also runs in the detail page (`setInterval(... 3000)`) for the case where the socket connection drops mid-job — once the document hits `completed`, the interval clears itself.

### 5. Cache only what is safe to be 60 seconds stale

- The list view (`GET /assignments`) is the only cached read — it's the most-hit endpoint and its content changes only on create / delete / regenerate, all of which explicitly `del('assignments:list')`.
- Single-document reads (`GET /assignments/:id`) are **never** cached, because the detail page polls during generation and stale data would freeze the UI.
- The PDF buffer is cached **in Mongo**, not Redis — buffers can be megabytes and are bound to one document's lifetime.

### 6. Render PDFs on the server, render previews on the client

Two rendering paths exist:

- **HTML preview** on `/assignments/[id]` — Tailwind-styled, matches the on-screen design.
- **PDF export** through PDFKit (`services/pdfRenderer.ts`) — explicit font choices (Helvetica family), hex colors, rounded difficulty badges, manual page-break checks (`if (doc.y > doc.page.height - 200) doc.addPage()`).

`html2pdf.js` is in the frontend dependencies as a fallback path but the production flow always goes through the server renderer because the output is deterministic, paginates correctly, and can be cached as a `Buffer`.

### 7. Keep the form honest

The create form is the user's only structured input, so it gets two layers of validation:

- **Per-field client-side** with the same Zod schema (`createAssignmentSchema` in `lib/schemas.ts`) that the backend uses (`createSchema` in `routes/assignments.ts`). Errors are mapped onto `errors[field]` and rendered inline under each input.
- **Server-side** Zod re-validation that returns `400 Validation failed` with `issues[]` if anything sneaks through.

The question-type matrix is its own mini-controller: rows can be added, removed (with the last row locked), and totals (`totalQuestions`, `totalMarks`) update live from the row state.

### 8. Mobile-first, opinionated UI

- The same components serve desktop and mobile — Tailwind breakpoints (`md:`) collapse the question-type table into stacked cards, swap the sidebar for a drawer + bottom tab bar, and hide non-essential controls.
- A floating "Create Assignment" pill anchors the empty state on mobile.
- The "VedaAI" brand mark is a CSS gradient — no logo asset to ship.

---

## Bonus

Two pieces of polish that go beyond the spec.

### 1. Beautified notifications (Sonner with rich variants + promise-based confirms)

Browser `alert()` and `confirm()` are ugly, blocking, and impossible to style. Every user-facing message in VedaAI flows through **Sonner** instead, with two upgrades over the default.

**Global config in `frontend/src/app/layout.tsx`:**
```tsx
<Toaster position="top-right" richColors closeButton />
```
- `richColors` enables semantic green/red/amber styling for `toast.success` / `toast.error` / `toast.warning`.
- `closeButton` adds an explicit dismiss affordance on every toast.
- `position="top-right"` keeps notifications out of thumb reach on mobile and away from the primary action area.

**Usage across the app:**
- `toast.success("Fresh questions generated")` after a regenerate completes.
- `toast.error("Generation failed: <message>")` when the worker emits `job:failed`.
- `toast.error("PDF generation failed: <message>")` on `pdf:failed`.
- `toast.success("PDF downloaded successfully")` after the browser auto-download triggers.

**The interesting bit — confirmation dialogs as awaitable promises.** Instead of `window.confirm`, both the **Delete Assignment** flow (in `AssignmentCard.tsx`) and the **Regenerate Paper** flow (in `assignments/[id]/page.tsx`) wrap a Sonner toast in a `Promise<boolean>`:

```tsx
const confirmed = await new Promise<boolean>((resolve) => {
  toast("Regenerate this paper?", {
    description: "This will replace the current questions with a fresh set.",
    action: { label: "Regenerate", onClick: () => resolve(true) },
    cancel:  { label: "Cancel",     onClick: () => resolve(false) },
    duration: 10000,
    onDismiss:   () => resolve(false),
    onAutoClose: () => resolve(false),
  });
});
if (!confirmed) return;
```

This gives `async/await` ergonomics with a styled, non-blocking, on-brand dialog — and every dismissal path (cancel button, X, auto-close after 10 s, manual dismiss) correctly resolves to `false`, so the regenerate never runs by accident.

### 2. Real Regenerate function (not "create a new assignment in disguise")

A naive regenerate would just call `POST /assignments` again with the same form data, leaving the user with two assignments cluttering their list and orphaning the cached PDF. The real implementation reuses the same document and resets the two lifecycle state machines in lockstep.

**Backend — `POST /api/assignments/:id/regenerate` (`backend/src/routes/assignments.ts`):**

```ts
router.post("/:id/regenerate", async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ error: "Not found" });

  // Reset BOTH lifecycles back to their starting states
  assignment.status = "pending";
  assignment.generatedPaper = undefined;
  assignment.pdfStatus = "none";
  assignment.pdfBuffer = undefined;
  assignment.pdfGeneratedAt = undefined;
  assignment.pdfJobId = undefined;
  await assignment.save();

  // Enqueue a fresh generation job using the SAME stored inputs
  const job = await generationQueue.add("generate", {
    assignmentId: assignment._id.toString(),
    title: assignment.title,
    questionTypes: assignment.questionTypes,
    additionalInstructions: assignment.additionalInstructions,
    fileContent: assignment.fileContent,
  });

  assignment.jobId = job.id;
  await assignment.save();

  await redisConnection.del("assignments:list");

  return res.status(202).json({ assignmentId: assignment._id, jobId: job.id, status: "pending" });
});
```

Key properties:
- **Same document, same `_id`** — no orphaned records, no duplicate list entries.
- **Both state machines reset** — `status`, `generatedPaper`, *and* the entire PDF lifecycle (`pdfStatus`, `pdfBuffer`, `pdfGeneratedAt`, `pdfJobId`) are cleared in one save. Without this, the user would get a fresh paper but an old, cached PDF — silent data corruption.
- **Same queue, same worker** — regeneration reuses the production generation pipeline. There is no second code path that could drift out of sync with the real one.
- **Cache invalidated** — the new `pending` status reaches the list immediately.

**Frontend — `handleRegenerate` in `frontend/src/app/assignments/[id]/page.tsx`:**

```tsx
const handleRegenerate = async () => {
  // 1. Sonner-promise confirm (see Bonus #1)
  const confirmed = await new Promise<boolean>(/* ... */);
  if (!confirmed) return;

  setRegenerating(true);
  try {
    // 2. Hit the endpoint
    const result = await regenerateAssignment(assignment._id);

    // 3. Wire the new jobId into Zustand and Socket.IO
    setCurrentJobId(result.jobId);
    setGenerationStatus("pending");
    subscribeToJob(result.jobId);

    // 4. Optimistically flip the UI to the GeneratingState so the user
    //    doesn't have to wait for the next poll/socket tick
    setAssignment({
      ...assignment,
      status: "pending",
      generatedPaper: undefined,
      pdfStatus: "none" as any,
    } as Assignment);
  } catch (err) {
    toast.error("Failed to regenerate. Please try again.");
    setRegenerating(false);
  }
};
```

The flow stitches together every system in the app:

1. **Sonner promise confirm** asks for consent without a modal blocker.
2. The button's spinner state (`<RefreshCw className={regenerating ? "animate-spin" : ""} />`) tells the user the request is in flight.
3. **`subscribeToJob(result.jobId)`** joins the new Socket.IO room so the *existing* socket listeners (`onProgress`, `onComplete`, `onFailed`) on this page automatically pick up the new job — no listener re-binding needed.
4. **Optimistic local state update** flips `assignment.status` to `"pending"` immediately, which triggers the existing top-level render switch:
   ```tsx
   if (assignment.status === "pending" || assignment.status === "processing") {
     return <GeneratingState />;
   }
   ```
   So the user sees the progress bar with no flicker.
5. When `job:complete` arrives, `onComplete` calls `updatePaper(data.paper)` and `fetchAssignment()`, and a `toast.success("Fresh questions generated")` fires — but **only if `regenerating` is `true`**, so first-time generations don't get a misleading "fresh" message.

The result is a regenerate button that feels instant, recovers cleanly from failure, and never leaves the database in a half-updated state.
