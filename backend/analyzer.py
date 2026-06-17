import json
import random
import time

from google import genai
from google.genai import types

from pydantic import ValidationError
from .exceptions import LLMEmptyError, LLMOverloadError, LLMResponseError
from .schemas import AnalyzeRequest, AnalyzeResponse

MAX_RETRIES = 3
BASE_DELAY = 1.0


def analyze_text(
    request: AnalyzeRequest,
    *,
    client: genai.Client,
    prompt: str,
    model: str = "gemini-3.5-flash",
) -> AnalyzeResponse:
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=request.text,
                config=types.GenerateContentConfig(
                    system_instruction=prompt,
                    response_mime_type="application/json",
                ),
            )
            break
        except Exception as e:
            status = getattr(e, "code", None) or getattr(e, "status_code", None)
            is_unavailable = status == 503 or "UNAVAILABLE" in str(e)
            if is_unavailable and attempt < MAX_RETRIES:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                time.sleep(delay)
                continue
            if is_unavailable:
                raise LLMOverloadError(
                    "El servicio de análisis está temporalmente saturado. Inténtalo de nuevo en unos segundos."
                ) from e
            raise LLMResponseError(
                f"Gemini API error (HTTP {status}): {e}"
            ) from e

    raw = response.text
    if not raw:
        raise LLMEmptyError(
            "Gemini returned an empty response. The model may have been blocked."
        )

    try:
        data = json.loads(raw)
        result = AnalyzeResponse(**data)
        result.summary.total = sum(result.summary.by_type.values())
        return result
    except json.JSONDecodeError as e:
        raise LLMResponseError(
            "Failed to parse Gemini response as JSON.", raw[:500]
        ) from e
    except ValidationError as e:
        raise LLMResponseError(
            f"Failed to validate Gemini response schema: {e}", raw[:500]
        ) from e
