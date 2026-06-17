from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .analyzer import analyze_text
from .error_types import ALL_TYPES, ERROR_COLORS, ERROR_LABELS
from .exceptions import AnalysisError, ConfigError, LLMEmptyError, LLMOverloadError, LLMResponseError
from .schemas import AnalyzeRequest, AnalyzeResponse, ErrorTypeInfo, ErrorTypesResponse

load_dotenv()

import os

api_key = os.getenv("GEMINI_API_KEY")
if not api_key or not api_key.strip():
    raise ConfigError("GEMINI_API_KEY environment variable is not set or is empty")

client = genai.Client(api_key=api_key)

prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"
SYSTEM_PROMPT = prompt_path.read_text()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Corrector de Español", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AnalysisError)
def handle_analysis_error(request: Request, exc: AnalysisError) -> JSONResponse:
    if isinstance(exc, LLMEmptyError):
        status = 502
    elif isinstance(exc, LLMOverloadError):
        status = 503
    elif isinstance(exc, LLMResponseError):
        status = 502
    else:
        status = 500
    return JSONResponse(
        status_code=status,
        content={"detail": str(exc), "code": type(exc).__name__},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/error-types", response_model=ErrorTypesResponse)
def list_error_types() -> ErrorTypesResponse:
    return ErrorTypesResponse(
        types=[
            ErrorTypeInfo(
                type=t.value,
                label=ERROR_LABELS[t],
                colors=ERROR_COLORS[t],
            )
            for t in ALL_TYPES
        ]
    )


@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
def analyze(request: Request, body: AnalyzeRequest) -> AnalyzeResponse:
    return analyze_text(
        body,
        client=client,
        prompt=SYSTEM_PROMPT,
    )


frontend = Path(__file__).resolve().parent.parent / "frontend"
if frontend.exists():
    app.mount("/", StaticFiles(directory=str(frontend), html=True), name="frontend")
