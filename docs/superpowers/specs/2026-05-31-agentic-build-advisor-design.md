# PCease v1 — Agentic Build Advisor (Design Spec)

**Date:** 2026-05-31
**Status:** Approved — ready for implementation plan
**Scope:** Replace PCease's stateless single-shot AI Advisor with a true grounded **agentic build assistant** that runs a tool-use loop over the real component database, streams its reasoning transparently, and can take actions on the user's behalf.

---

## 1. Background & Problem

PCease today has an "AI Advisor" that is **not agentic**. It is two stateless, single-shot Gemini prompts:

- `POST /api/advisor/recommend` — one Gemini call that **hallucinates** product names and prices from the model's training data, ignoring the real component database. It only touches the DB in the deterministic `_build_smart_recommendation` fallback.
- `POST /api/advisor/ask` — one Gemini Q&A call with **no memory, no tools, and no access** to components, prices, the user's current build, or the forum.

The gap: the AI cannot *see* the real data, cannot *act*, and cannot *reason across steps*. This spec closes that gap with an agent that uses tools over the real Supabase data in a multi-step loop.

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Vision | **Grounded build agent** — agent uses tools over the REAL DB in a multi-step loop with conversation memory |
| LLM | **Provider-agnostic** — Claude (Anthropic) and Gemini, switchable via config |
| Tools | **All four categories**: read/query, analysis, build assembly, write actions |
| Chat UX | **Transparent + streaming** — show tool steps live, stream tokens, inline build cards (SSE) |
| Agent core | **Hand-rolled loop using LangChain Core as a library** (not as a runtime) |

### Out of scope (YAGNI for v1)

- Background price-drop monitoring / deal alerts / scheduled re-optimization.
- New database tables (conversation memory lives client-side).
- RAG / vector search over reviews or the forum.
- Replacing the Manual or Presets tabs (they stay as-is).

---

## 2. Architecture

A new `backend/app/agent/` package plus one streaming endpoint. **LangChain Core is used as a library** for model abstraction and tool-schema generation; the application loop and the SSE event stream remain hand-written and fully owned.

```
backend/app/agent/
├── __init__.py
├── tools.py        # @tool-decorated functions (auto JSON schema) + name→callable registry
├── loop.py         # custom async loop: model.astream() → accumulate chunks → emit SSE → exec tools → ToolMessage → repeat
├── llm.py          # get_chat_model(config): ChatAnthropic(...).bind_tools() | ChatGoogleGenerativeAI(...).bind_tools()
└── prompts.py      # system prompt: PCease India expert, grounding & action rules
backend/app/routers/
└── agent.py        # POST /api/agent/chat → text/event-stream (SSE).  Loop + endpoint are 100% ours.
```

**Provider abstraction (`llm.py`).** A ~15-line factory returns a tool-bound LangChain chat model based on config:

- `ChatAnthropic(model=...).bind_tools(tools)` when `llm_provider == "claude"`
- `ChatGoogleGenerativeAI(model=...).bind_tools(tools)` when `llm_provider == "gemini"`

LangChain normalizes the otherwise-divergent Anthropic vs Gemini tool-call request/response formats and message types (`HumanMessage`, `AIMessage` w/ `tool_calls`, `ToolMessage`). This is the specific value we extract from LangChain; we do **not** use `AgentExecutor` or `LangGraph`.

**Config (`config.py`) additions** (backward compatible — all defaulted):

```python
llm_provider: str = "claude"          # "claude" | "gemini"
anthropic_api_key: str = ""
claude_model: str = "claude-haiku-4-5-20251001"
gemini_model: str = "gemini-1.5-flash"
agent_max_iterations: int = 8
```

Provider auto-selection: if `llm_provider`'s key is missing but the other provider's key is present, fall back to the available one; if neither key is present, the agent endpoint returns a clear config error and the existing deterministic `_build_smart_recommendation` remains the non-AI fallback for build requests.

---

## 3. The Agent Loop (`loop.py`)

The core of "agentic." Pseudocode:

```python
async def run_agent(messages, *, db, user, emit):
    model = get_chat_model(settings)          # tool-bound LangChain chat model
    for _ in range(settings.agent_max_iterations):
        gathered = None
        async for chunk in model.astream(messages):
            if chunk.content:
                emit("token", chunk.content)               # stream text deltas
            gathered = chunk if gathered is None else gathered + chunk   # accumulate
        messages.append(gathered)                          # the AIMessage (may carry tool_calls)

        tool_calls = gathered.tool_calls or []
        if not tool_calls:
            break                                          # model is done

        for tc in tool_calls:
            emit("tool_start", {"name": tc["name"], "label": label_for(tc), "args": tc["args"]})
            result = await execute_tool(tc, db=db, user=user, emit=emit)   # may emit "build"
            messages.append(ToolMessage(content=result.text, tool_call_id=tc["id"]))
            emit("tool_end", {"name": tc["name"], "summary": result.summary})
    emit("done", {})
```

**Critical implementation note — streaming tool-call accumulation.** When using `model.astream()`, tool-call arguments arrive **fragmented across chunks**; `chunk.tool_calls` is not reliably populated per-chunk. We MUST accumulate (`AIMessageChunk` supports `+`) and read `gathered.tool_calls` only after the stream for that turn completes. Emitting `tool_start` early from a partial `tool_call_chunk` (name-only) is possible but deferred — v1 emits `tool_start` once the complete tool call is known.

**Guards:** hard cap of `agent_max_iterations`; per-tool try/except that returns the error text back to the model as a `ToolMessage` so it can self-correct rather than crashing the stream.

---

## 4. Tools (`tools.py`)

Each tool is an `@tool`-decorated function (LangChain auto-generates the JSON schema from signature + docstring). A registry maps tool name → callable. DB access and the authenticated user are injected by the executor (not model-supplied).

| Tool | Signature (model-visible args) | Returns | Type |
|---|---|---|---|
| `search_components` | `category, max_price?, min_price?, brand?, query?, sort?, limit?` | list of `{id, name, brand, key_specs, lowest_price, best_vendor}` | read |
| `get_component` | `component_id` | full specs + all vendor prices | read |
| `check_compatibility` | `component_ids[]` | `{compatible, issues[]}` — socket, form-factor, RAM-type checks | analysis |
| `estimate_wattage` | `component_ids[]` | `{total_tdp, recommended_psu, breakdown[]}` | analysis |
| `check_bottleneck` | `cpu_id, gpu_id` | `{status, severity, message}` | analysis |
| `assemble_build` | `title, items[]` (each `{slot, component_id}`) | structured build card; **emits a `build` SSE event** | build |
| `save_build` | `name, components{slot: component_id}` | saved build record | write (auth + confirm) |
| `create_share_link` | `name, components{slot: component_id}` | `{share_id, url}` | write (auth) |

**Reused / corrected logic.** `estimate_wattage` and `check_bottleneck` reuse the logic in `advisor.py`, **fixing the latent bug** where they query a non-existent `specs` column instead of `specifications` (see `advisor.py` lines ~470 and ~521). `save_build` / `create_share_link` reuse the build-persistence logic from `components.py`.

**`check_compatibility` (new logic).** Grounded checks from `specifications` JSON:
- CPU socket vs motherboard socket.
- RAM type (DDR4/DDR5) vs motherboard supported type.
- Motherboard form factor vs case supported form factors.
- (Best-effort; returns informative `issues[]` when a needed spec is absent rather than failing.)

**Write-action safety.** `save_build` and `create_share_link` require an authenticated user (Bearer token on the request). If the user is not logged in, the tool returns a message instructing the agent to ask the user to log in — the agent surfaces that conversationally rather than erroring. The system prompt instructs the agent to **confirm with the user before** calling a write tool.

---

## 5. Streaming Protocol (SSE)

Endpoint: `POST /api/agent/chat`, `Content-Type: text/event-stream`. We POST (not `EventSource`) because we send full message history; the frontend reads the stream via `fetch` + `ReadableStream`.

**Request body:**
```json
{
  "messages": [{"role": "user|assistant", "content": "..."}],
  "build_context": {"cpu": 12, "gpu": 34, ...}   // optional: user's current Builder slots
}
```

**SSE event types** (`event:` name + JSON `data:`):

| Event | Data | Meaning |
|---|---|---|
| `token` | `string` | text delta to append to the assistant message |
| `tool_start` | `{name, label, args}` | a tool is about to run (renders a step chip) |
| `tool_end` | `{name, summary}` | tool finished (chip → done state) |
| `build` | `{title, items[], total, within_budget}` | a grounded build card to render inline |
| `error` | `{message}` | recoverable error; show a graceful message |
| `done` | `{}` | stream complete |

`build_context` lets the agent answer "is my current build balanced?" or "what should I upgrade?" grounded in what the user already has.

---

## 6. Conversation Memory

**Stateless server** (matches the existing API style; no new DB tables). The **client holds the message history** and resends it each turn. Within a single request, the loop appends `AIMessage` + `ToolMessage`s to the working list as it runs. The frontend trims history to a sane window (e.g. last ~20 messages) before sending.

---

## 7. Frontend

Rewrite the Advisor **AI Chat tab** ([frontend/src/pages/Advisor.jsx](../../../frontend/src/pages/Advisor.jsx), the `tab === 'ai'` block) into the agent experience. **Manual and Presets tabs are unchanged.**

**New pieces:**
- `frontend/src/services/agentStream.js` — a small SSE-over-fetch parser: posts to `/agent/chat`, reads the `ReadableStream`, parses `event:`/`data:` frames, yields typed events.
- `frontend/src/hooks/useAgentChat.js` — manages message list + streaming state; consumes the parser; exposes `send(text)`, `messages`, `isStreaming`.
- Rendering in `Advisor.jsx`:
  - User bubbles + assistant bubbles with lightly-formatted streaming text. To honor "no new frontend deps," a **tiny inline formatter** (bold `**…**`, bullet lines, inline `code`) replaces the current raw `<pre>` rendering — no markdown library added.
  - **Tool-step chips** under the assistant message: e.g. "🔍 Searching GPUs under ₹20,000…" → "✓ Found 8". Driven by `tool_start`/`tool_end`.
  - Inline **build cards** (from `build` events): parts list with names/vendors/prices, total, within-budget badge, and **"Open in Builder"** (`navigate('/builder', { state: { recommendation } })` — handoff already supported) + **"Save"** buttons.
- `API.askAI` is superseded by the streaming hook for the AI tab. The old `/advisor/ask` endpoint stays for backward compatibility but is no longer called by the AI tab.

**Auth interaction.** The Bearer token (already in `localStorage` as `pcease_token`, attached by `services/api.js`) is sent with the agent request, enabling write tools. The "Save" action on a build card is gated on login; logged-out users are prompted to sign in.

---

## 8. Error Handling & Fallback

- **Provider/API failure** → emit `error` event + a graceful assistant message. For explicit build requests, fall back to the deterministic `_build_smart_recommendation` and render it as a `build` card.
- **Tool execution error** → returned to the model as a `ToolMessage` so it can self-correct; if it loops unproductively, the iteration cap stops it.
- **Missing API keys** → endpoint returns a clear config error; deterministic engine remains the non-AI path.
- **Write tools while logged out** → tool returns an "ask the user to log in" message; agent surfaces it conversationally.
- **Gemini caveat** → Gemini's streamed tool-calling via LangChain is less battle-tested than Anthropic's; provider-adapter tests cover both explicitly, and config defaults to whichever key is present (Claude preferred when both exist).

---

## 9. Testing

| Layer | Test |
|---|---|
| Tools | Unit test each tool with a mocked Supabase client — deterministic inputs/outputs, including the `specifications` fix and compatibility edge cases. |
| LLM factory | `get_chat_model` returns the right bound model per config; falls back correctly when a key is missing. |
| Agent loop | Drive `loop.py` with a **scripted fake chat model** (yields canned `AIMessageChunk`s incl. tool calls) → assert tools execute, `ToolMessage`s append, loop terminates, SSE events emit in order. |
| Endpoint | Integration test of `POST /api/agent/chat` with the fake model → assert the SSE event sequence (`tool_start` → `tool_end` → `build` → `done`). |
| Frontend | Unit test `agentStream.js` parser against a canned byte stream; smoke test `useAgentChat` reducer transitions. |

---

## 10. Dependencies

Add to `backend/requirements.txt`:
```
langchain-core>=0.3
langchain-anthropic>=0.3
langchain-google-genai>=2.0
```
These pull the official Anthropic / Google SDKs transitively. The existing `google-generativeai` dependency remains (still used by the legacy `/advisor/recommend` and `/advisor/ask` endpoints, which we keep for backward compatibility). Net footprint increase is moderate — acceptable on Render, but a factor to keep in mind on the 512MB free tier.

No new frontend dependencies (SSE via native `fetch`; lightly-formatted text via a tiny inline formatter — see §7).

---

## 11. Backward Compatibility & Migration

- Legacy `/advisor/recommend`, `/advisor/ask`, `/advisor/templates`, `/advisor/wattage`, `/advisor/bottleneck` endpoints are **untouched** — Manual and Presets tabs keep working unchanged.
- New surface is purely additive: `backend/app/agent/`, `routers/agent.py`, and the rewritten AI Chat tab.
- No DB schema changes, so no migration needed.
