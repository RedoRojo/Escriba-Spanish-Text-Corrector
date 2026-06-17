class AnalysisError(Exception):
    """Base error for analysis failures."""


class ConfigError(AnalysisError):
    """Missing or invalid configuration."""


class LLMEmptyError(AnalysisError):
    """LLM returned no content."""


class LLMResponseError(AnalysisError):
    """LLM returned unparseable or invalid content."""

    def __init__(self, message: str, raw: str = "") -> None:
        super().__init__(message)
        self.raw = raw


class LLMOverloadError(AnalysisError):
    """LLM is overloaded (HTTP 503) after retries."""
