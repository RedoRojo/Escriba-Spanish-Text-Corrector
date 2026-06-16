import json

from google import genai
from google.genai import types

from pydantic import ValidationError
from .exceptions import LLMEmptyError, LLMResponseError
from .schemas import AnalyzeRequest, AnalyzeResponse


def analyze_text(
    request: AnalyzeRequest,
    *,
    client: genai.Client,
    prompt: str,
    model: str = "gemini-2.5-flash",
) -> AnalyzeResponse:
    try:
        response = client.models.generate_content(
            model=model,
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=prompt,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        status = getattr(e, "code", None) or getattr(e, "status_code", None)
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
