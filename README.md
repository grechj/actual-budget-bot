# AB Bot

AB Bot is a local-first AI companion for [Actual Budget](https://actualbudget.org/). It is designed to help import messy financial data, review it safely, write clean transactions into Actual, and provide structured budget recommendations without taking ownership away from the user.

## What It Does

- Imports bank CSV files into a canonical transaction format
- Normalizes dates, descriptions, debit/credit columns, and signed amounts
- Generates stable import IDs for deduplication
- Provides an adapter boundary for Actual Budget's official `@actual-app/api` package
- Defines an AI tool layer so agents query structured budget data before giving advice

## What It Will Do Next

- Saved CSV mapping profiles per bank
- Review and edit UI before import
- Dry-run imports into Actual Budget
- OCR ingestion for banking screenshots
- Category suggestions based on Actual history and user corrections
- Daily position statements and end-of-month forecasts
- Pluggable AI providers: local, OpenAI, Anthropic, and others

## Why Actual Budget Stays the Source of Truth

Actual already handles envelope budgeting, accounts, categories, rules, reconciliation, sync, and budget math. AB Bot should sit beside it as an ingestion and assistant layer rather than duplicating the finance engine.

Actual's supported programmatic interface is the Node.js package `@actual-app/api`; it is not a REST API. Transaction imports should use `importTransactions` so Actual can run its existing import reconciliation and rules.

## Current Project Shape

```plaintext
src/
  adapters/
    actualBudget.js    Actual Budget API boundary
  ai/
    provider.js        Provider interface placeholder
    tools.js           Structured budget tools for agents
  ingestion/
    csv.js             CSV parser and mapping inference
    dedupe.js          Stable imported_id generation
    normalize.js       Canonical transaction normalization
  cli.js               Local CSV preview command
test/
  csv.test.js
docs/
  architecture.md
```

## Try The CSV Preview

```bash
node src/cli.js csv:preview ./path/to/bank.csv
```

With an explicit mapping profile:

```bash
node src/cli.js csv:preview ./path/to/bank.csv --mapping ./examples/mappings/example-bank.json
```

For bank exports without a header row:

```bash
node src/cli.js csv:preview ./path/to/bank.csv --mapping ./examples/mappings/no-header-date-amount-description-balance.json
```

For a safer short preview while testing:

```bash
node src/cli.js csv:preview ./path/to/bank.csv --mapping ./examples/mappings/no-header-date-amount-description-balance.json --limit 10
```

For only counts, issues, and duplicate row references:

```bash
node src/cli.js csv:preview ./path/to/bank.csv --mapping ./examples/mappings/no-header-date-amount-description-balance.json --summary
```

The command prints headers, mapping, canonical transactions, duplicate candidates, validation issues, and a summary. It does not write to Actual yet.

## Configuration

Copy `.env.example` to `.env` when you are ready to connect to Actual:

```bash
AB_BOT_DATA_DIR=.ab-bot/data
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=
ACTUAL_BUDGET_ID=
```

Actual budget IDs are available in Actual's advanced settings.

## Open-Source Principles

- Local-first by default
- Human review before commit
- Structured data before AI
- Actual Budget remains the financial source of truth
- AI advice is advisory, never automatic authority
- Provider choice should be user-controlled

## Roadmap

### Phase 1

- CSV import preview: implemented
- Mapping inference: implemented
- Canonical transaction model: implemented
- Duplicate detection: implemented
- Mapping profile support: implemented
- Row-level validation issues: implemented

### Phase 2

- Saved mapping profiles: implemented
- Review/edit workflow: implemented
- Actual dry-run import: implemented as a guarded CLI command
- Actual commit import: implemented with explicit `--yes`
- Actual import output: count-only by default, with optional `--ids`

See [docs/phase-2.md](docs/phase-2.md).

### Phase 3

- Budget summary tools: implemented
- Category suggestion engine: implemented
- First AI provider: implemented for OpenAI Responses API
- Local category rules: implemented
- AI provider registry: implemented

See [docs/phase-3.md](docs/phase-3.md).

### Phase 4

- Local Ollama provider: implemented
- OCR text preview: implemented with deterministic regex parsing
- Simple local web UI: implemented
- OCR screenshot ingestion
- Confidence scoring
- Multi-provider AI settings

See [docs/phase-4.md](docs/phase-4.md).

## Local Web UI

Run:

```bash
npm run web
```

Then open:

```text
http://127.0.0.1:3000
```

The first UI is intentionally small: CSV preview, OCR text preview, account selection, and budget chat. Screenshot upload is scaffolded, with Tesseract image OCR planned next.

### Phase 5

- Multi-user access
- Backup and recovery helpers
- Polished web UI
