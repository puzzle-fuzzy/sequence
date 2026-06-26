# Phase 8: Full Model Port + Type System Extension + ASR/LLM Clients

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** (1) Extend the bailian-core type system to cover v1's special field types and request shapes, then port all 35 remaining models. (2) Extend RequestType to support the 3 image endpoints. (3) Add ASR + LLM (qwen-vl-plus) clients to bailian-client, and wire the analysis worker handlers so frontend can run each step independently.

**Confirmed scope (user decisions):**
- Models: **all 35** + extend type system (multi-text/shot-list/color-palette, Kling mode, PixVerse size alias, element_list)
- Image engine: **extend RequestType** for 3 endpoints (multimodal-sync / image-generation-async / image2image-async)
- ASR/LLM: **full implementation, split into independent steps** (not v1's monolithic pipeline) — frontend calls each step separately

**Reference sources:**
- v1 models: `/Users/yxswy/Documents/uhyc/packages/bailian/src/{video,image,music}/models/`
- v1 creativity pipeline: `/Users/yxswy/Documents/uhyc/services/api/src/modules/creativity/service.ts`
- ASR spec: `/Users/yxswy/Documents/uhyc/docs/bailian/Paraformer录音文件识别RESTful.md`

---

## Part A: Type System + Engine Extension

### A1. Extend `ParameterType` in bailian-core

`packages/bailian-core/src/types.ts` — `ParameterType` already has `multi-text | color-palette | shot-list` (added in Phase 3). Verify; if missing add. These are UI rendering hints; the engine treats them as opaque values. Add `min`/`max` semantics for `shot-list` (already on ModelParameter).

### A2. Extend `InputMapping` with aliased-parameter (for PixVerse `size`)

v1's `apiKey: 'size'` renames a param when sent to API. v2 InputMapping has `mediaField { field }` for input-layer rename; for **parameters-layer rename** add:

```ts
| { target: 'parameter'; field?: string }  // field omitted → use paramName; field set → alias
```

So PixVerse `resolution` → `{ target: 'parameter', field: 'size' }` sends it as `parameters.size`. Update `applyMappings` to honor `mapping.field` for parameter target.

### A3. Extend `RequestType` for 3 image endpoints

```ts
export type RequestType =
  | 'chat' | 'image'              // existing (multimodal-generation, sync, Chat-style messages)
  | 'image-async'                 // image-generation/generation (kling-image, async submit→poll)
  | 'image2image'                 // image2image/image-synthesis (qwen-mt-image, async)
  | 'video-t2v' | 'video-media' | 'audio'  // existing
```

Add `buildRequestBody` cases:
- `image-async`: flat `input` (prompt) + `parameters` (size/n/watermark), no messages wrapping — verify against v1 kling-image request body.
- `image2image`: `input { image_url, source_lang, target_lang }` + `parameters`.

### A4. Update bailian-client tests for new RequestType + parameter alias

---

## Part B: Port 35 Models (in dependency order)

Port order (each batch is a commit; sync worker models after):

1. **video-t2v** (8): happyhorse-t2v, vidu-{q3-pro,q3-turbo,q2}-t2v, pixverse-{c1,v6,v56}-t2v, kling-{v3,v3-omni}-t2v
2. **video-media i2v** (12): happyhorse-i2v, vidu-{q3-pro,q3-turbo,q2-pro-fast,q2-pro,q2-turbo}-i2v, vidu-kf×4, pixverse-{c1,v6,v56}-i2v + kf×3, kling-{v3,v3-omni}-i2v + kf×2
3. **video-media r2v** (9): happyhorse-r2v, vidu-{q3-mix,q3,q3-turbo,q2-pro,q2}-r2v, pixverse-{c1,v6,v56}-r2v, kling-v3-omni-r2v
4. **video-media edit** (2): happyhorse-video-edit, kling-v3-omni-video-edit
5. **image text-to-image** (4): kling-{image-gen,omni-image-gen}, wan27-{image-pro,image}, z-image-turbo
6. **image image-to-image** (1): qwen-image-edit (media field key `images`)
7. **image reference-to-image** (1): qwen-image-translation (image2image endpoint, text image_url)

Each port: read v1 file → map to v2 ModelConfig (rename fields→parameters/key→name, derive requestType, build inputMapping including size alias / Kling mode / media field key, port pricing/refSyntax) → add to api registry barrel + worker models copy → registry self-check test catches gaps.

**Worker models sync**: after each batch, copy new model files to `services/worker/src/models/` and register in `worker-models.ts`.

---

## Part C: ASR + LLM Clients in bailian-client

### C1. ASR client (`packages/bailian-client/src/asr.ts`)

```ts
// Submit async ASR (paraformer-v2)
export async function submitAsr(config, videoUrl, params?): Promise<{ taskId: string; requestId: string }>
// Poll ASR task
export async function queryAsrTask(config, taskId): Promise<{ status, transcriptionUrl?, usage?, errorCode?, errorMessage? }>
// Download + parse transcription_url JSON → { text, srt, sentences }
export async function fetchTranscription(transcriptionUrl): Promise<{ text: string; srt: string; sentences: Array<{begin:number,end:number,text:string,speakerId?:number}> }>
// Convenience: submit → poll → fetch (with intervalMs/maxAttempts)
export async function runAsr(config, videoUrl, opts?): Promise<AsrResult>
```

Constants: POLL_INTERVAL=5000, MAX_POLLS=60. Port `msToSrtTime` helper.

### C2. LLM multimodal client (`packages/bailian-client/src/llm.ts`)

```ts
// qwen-vl-plus multimodal call (video or image input)
export async function chatMultimodal(config, { model, content: Array<{text?,video?,image?}> }): Promise<{ text: string; raw: unknown }>
```

Endpoint `/services/aigc/multimodal-generation/generation`, sync.

### C3. analysis worker handlers (`services/worker/src/handlers/analysis.ts`)

**analysis.asr**: call `runAsr(ctx.bailian, videoUrl)` → store `{ text, srt, sentences }` as step result.
**analysis.script**: load prior asr step result → `chatMultimodal` (video understand, video=videoUrl) → `chatMultimodal` (merge, text=asr.text+understand result) → store merged script.

Both are independent tasks (frontend calls each separately). The analysis_steps schema already supports per-step results.

---

## Part D: Tests + Verification

- bailian-core: new ParameterType/RequestType/InputMapping typecheck
- bailian-client: asr/llm client tests (fetch-mocked), parameter-alias buildRequestBody test, new RequestType buildRequestBody tests
- api registry: self-check passes for all 40 models (5 existing + 35 new); every requestType covered
- worker handlers: analysis.asr/analysis.script with mocked asr/llm clients

---

## Execution Order

1. Part A (type system + engine) — must come first, models depend on it
2. Part B batch 1-7 (models) — can stream commits
3. Part C (ASR/LLM clients + handlers)
4. Part D (tests)

## Self-Review

**Spec alignment**: §1.4 "每个模型每个参数可调" → 40 models with full inputMapping. §4.5 ProductExtractor + analysis handlers. All confirmed by user.

**Risk**: Part B is mechanical but voluminous (35 files × 2 copies for worker). Registry self-check (`assertModelConfigConsistent`) is the safety net — any model with a missing mapping fails loud at startup. Parameter alias (A2) and new RequestTypes (A3) need careful buildRequestBody tests before mass porting.
