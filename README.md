# Corrector de Español

A focused web tool that analyzes Spanish articles and essays, detects errors (spelling, grammar, punctuation, semantics, style), and returns a detailed report per mistake. Built as a portfolio project.

This project is inspired by the research paper:
* **"Imperfect Language, Artificial Intelligence, and the Human Mind: An Interdisciplinary Approach to Linguistic Errors in Native Spanish Speakers"** by Francisco Portillo López (arXiv:2511.01615).
* You can read the paper at [https://arxiv.org/pdf/2511.01615](https://arxiv.org/pdf/2511.01615).

## How it Works

1. **Text Submission**: The user pastes a Spanish text (20–5000 characters) into the frontend text area.
2. **Analysis Request**: The frontend makes a `POST /analyze` request to the FastAPI backend.
3. **LLM Evaluation**: The backend loads the system prompt from `prompts/system_prompt.txt` and calls the Gemini 2.5 Flash model via the `google-genai` SDK.
4. **Structured Response**: The model returns a structured JSON payload containing:
   - A list of error items (original text, suggested correction, category, and explanation).
   - A fully corrected version of the text.
   - Summary statistics (error counts broken down by category).
5. **Interactive UI**: The frontend highlights the flagged errors in-line. The user can click each highlighted error to view a popover detailing the correction and explanation, deciding whether to *Accept* or *Ignore* each individual correction.
6. **Final Draft**: Once all errors have been resolved, the final text block is updated and can be copied to the clipboard.

## System Prompt Origin

The categorization methodology and error types configured in our system prompt ([prompts/system_prompt.txt](file:///home/redo/Documents/projects/escriba/prompts/system_prompt.txt)) are directly derived from the classification framework described in the research paper cited above:

The prompt instructs the Gemini model to evaluate native Spanish speaker deviations and group errors under five distinct categories:
* `ortografía` (Spelling)
* `gramática` (Grammar agreement & verb conjugation)
* `puntuación` (Punctuation and diacritic marks)
* `semántica` (Contextually incorrect vocabulary)
* `estilo` (Style, redundancy, and awkward structure)

---

## Tech Stack

- **Backend:** Python + FastAPI
- **Frontend:** HTML + Tailwind CSS (CDN) + Vanilla JS
- **LLM:** Gemini 2.5 Flash (Google Gen AI SDK)
- **Deploy:** Railway.app

## Features

- Detects 5 error types: ortografía, gramática, puntuación, semántica, estilo
- Color-coded error cards with original text, correction, and explanation
- Summary bar with error count by type
- Full corrected text with copy-to-clipboard
- Rate-limited API (10 requests/min per IP)

## Setup

```bash
# Clone and enter the directory
git clone <repo-url> && cd corrector-espanol

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Run the server
uvicorn backend.main:app --reload
```

Open http://localhost:8000 in your browser.

## API

### `POST /analyze`

```json
{
  "text": "Texto en español para analizar (20-5000 caracteres)"
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

## Live Demo

[Add Railway URL here after deployment]
