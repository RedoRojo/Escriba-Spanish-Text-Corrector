# AGENTS.md

## Project

Spanish text corrector web app. Python FastAPI backend serves a static HTML/JS frontend; analysis calls Gemini 2.5 Flash via `google-genai` SDK.

## Run

```bash
uvicorn backend.main:app --reload
```

Requires `GEMINI_API_KEY` in `.env` (loaded via `python-dotenv`). App fails fast at startup if missing.

## Structure

- `backend/main.py` — FastAPI app, routes, static file mount. **Entrypoint.**
- `backend/analyzer.py` — Calls Gemini, parses JSON response into `AnalyzeResponse`.
- `backend/schemas.py` — Pydantic models for request/response.
- `backend/error_types.py` — `ErrorType` enum (ortografía, gramática, puntuación, semántica, estilo) + color map.
- `prompts/system_prompt.txt` — LLM system prompt. Must return strict JSON matching `AnalyzeResponse`.
- `frontend/` — Vanilla JS, no build step. Served by FastAPI at `/`.

## Key details

- Rate limit: 10 req/min per IP (`slowapi`).
- Input validation: 20–5000 chars (enforced in both Pydantic schema and frontend JS).
- Gemini response must be valid JSON; empty or unparseable responses raise `LLMEmptyError`/`LLMResponseError` (HTTP 502).
- Railway deploy uses `railway.json` — build via Nixpacks, no special build step.
- `start.sh` is the production start script (uses `$PORT` env var).
- No test suite, linter, formatter, or typecheck configured.
