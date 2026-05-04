# Phase 4 - Local Providers and OCR

Phase 4 starts the local-first AI and screenshot ingestion work.

## Ollama Provider

AB Bot can now call a local Ollama server using the same structured budget context as the OpenAI provider.

```bash
export AB_BOT_AI_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1

node src/cli.js ai:ask "What should I pay attention to this month?" --account-id ACCOUNT_ID --start-date 2026-01-01 --end-date 2026-01-31 --provider ollama --model llama3.1
```

Ollama must be running separately, and the selected model must already be available locally.

List local Ollama models:

```bash
node src/cli.js ai:ollama-models
```

If AB Bot says the selected model is not installed, either pull it:

```bash
ollama pull llama3.1
```

Or use one of the model names from `ai:ollama-models`. On older laptops, a smaller local model is usually a better first test.

## OCR Text Preview

The first OCR step is deliberately deterministic: AB Bot parses OCR text with exact regular-expression patterns before any AI is involved. This keeps token usage low and makes the parsing behavior easy to test.

Supported line shapes:

```text
2026-01-03 Corner Store 12.50 DR
Corner Store 2026-01-03 12.50 debit
Corner Store 12.50 2026-01-03 debit
```

Preview OCR text:

```bash
node src/cli.js ocr:text-preview examples/ocr/sample-bank-text.txt
```

If a bank screenshot lists only outflows without debit markers, you can tell AB Bot to treat unsigned amounts as debits:

```bash
node src/cli.js ocr:text-preview examples/ocr/sample-bank-text.txt --default-direction debit
```

The preview output uses the same canonical transaction shape as CSV imports, with `source.type` set to `ocr` and a confidence score on each parsed row.

## Next

- Add a Tesseract wrapper that converts image files into OCR text.
- Feed that text through the deterministic parser above.
- Create an OCR review file so screenshot imports use the same human approval workflow as CSV imports.

## Simple Web UI

Start the local UI:

```bash
npm run web
```

Open:

```text
http://127.0.0.1:3000
```

The UI is intentionally plain and local:

- Drag and drop CSV files for preview.
- Drag and drop OCR text files for parsing.
- Drag and drop screenshots to run local Tesseract OCR, then parse the extracted text.
- Choose an Actual Budget account and chat with the configured AI provider.
- Review parsed transactions in a table, run an Actual Budget dry run, then explicitly commit.

On macOS, AB Bot tries Apple Vision OCR first through Swift command-line tools. This avoids the heavy Homebrew Tesseract install in most cases.

If Apple Vision is unavailable, image OCR falls back to Tesseract:

```bash
brew install tesseract
```

You can also test image OCR from the terminal:

```bash
node src/cli.js ocr:image-preview screenshot.png
```
