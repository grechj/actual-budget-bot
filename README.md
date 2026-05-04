# AB Bot

AB Bot is a local-first companion for [Actual Budget](https://actualbudget.org/). It helps preview messy bank CSVs, parse banking screenshots, review transactions, import into Actual, and ask simple questions about your budget without replacing Actual as the source of truth.

## Privacy First

AB Bot runs locally by default. CSV files, screenshots, OCR text, previews, and Actual Budget data stay on your machine unless you deliberately configure a cloud AI provider such as OpenAI.

Use `AB_BOT_AI_PROVIDER=disabled` or `AB_BOT_AI_PROVIDER=ollama` if you want to keep AI fully local. Do not share real bank exports, screenshots, `.env` files, `.ab-bot` folders, or API keys in GitHub issues.

## Quickstart

1. Clone and install:

```bash
git clone https://github.com/grechj/actual-budget-bot.git
cd actual-budget-bot
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Start or open your local Actual Budget server. If you use the npm sync server:

```bash
npm install --location=global @actual-app/sync-server
ACTUAL_DATA_DIR=.ab-bot/actual-server actual-server
```

4. In Actual, create a test budget or open an existing one. Copy the **Sync ID** from Settings -> Advanced, then set these values in `.env`:

```env
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=your-local-actual-password
ACTUAL_BUDGET_ID=your-budget-sync-id
```

5. Start the local AB Bot UI:

```bash
npm run web
```

Open `http://127.0.0.1:3000`. The status panel should show whether Actual, CSV profiles, OCR, and AI are ready.

## Normal User Flow

1. Choose an Actual account.
2. Pick a CSV mapping profile if your bank export needs one.
3. Drag in a CSV or banking screenshot.
4. Review parsed transactions and warnings.
5. Click **Dry run**. Nothing is written to Actual.
6. If the dry run looks right, click **Commit to Actual** and confirm.
7. Ask AB Bot simple questions after choosing an account and date range.

The web UI is intentionally small for early testers. It is not yet a full Actual Budget replacement or hosted service.

## Test Mode / Sample Data

Use synthetic sample files before trying real data:

```bash
node src/cli.js csv:preview examples/csv/sample-bank.csv --summary
node src/cli.js ocr:text-preview examples/ocr/sample-bank-text.txt
```

For a no-header CSV profile:

```bash
node src/cli.js profile:save sample-no-header --mapping examples/mappings/no-header-date-amount-description-balance.json
node src/cli.js csv:review examples/csv/sample-no-header.csv --profile sample-no-header
```

For Actual imports, create a throwaway budget in Actual first, copy its Sync ID, and test dry-run before commit.

## Configuration

Copy `.env.example` to `.env`.

Important settings:

- `ACTUAL_SERVER_URL`: usually `http://localhost:5006`
- `ACTUAL_PASSWORD`: your local Actual server password
- `ACTUAL_BUDGET_ID`: Actual Sync ID, not the display name
- `AB_BOT_AI_PROVIDER`: `disabled`, `ollama`, or `openai`
- `OPENAI_API_KEY`: only needed for OpenAI cloud AI
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL`: only needed for local Ollama
- `TESSERACT_BIN`: optional OCR fallback if Apple Vision is unavailable

## CSV Profiles

Auto-detect works for simple headered CSVs. For bank exports without headers, save a profile:

```bash
node src/cli.js profile:save commbank-no-header --mapping examples/mappings/no-header-date-amount-description-balance.json
```

Then select that profile in the web UI before dropping the CSV.

## Useful CLI Commands

```bash
node src/cli.js actual:accounts
node src/cli.js csv:preview ./path/to/bank.csv --limit 10
node src/cli.js review:summary .ab-bot/reviews/review-file.json --limit 10
node src/cli.js actual:dry-run .ab-bot/reviews/review-file.json --account-id actual-account-id
node src/cli.js actual:commit .ab-bot/reviews/review-file.json --account-id actual-account-id --yes
node src/cli.js ai:providers
```

## Current Features

- CSV preview and canonical transaction normalization
- Mapping inference and saved mapping profiles
- Duplicate detection with stable import IDs
- Review files and guarded Actual imports
- Actual dry-run and commit import paths
- Budget summaries and category suggestions
- AI provider registry with disabled, OpenAI, and Ollama providers
- OCR text/image preview with deterministic parsing for mobile banking screenshots
- Simple local web UI with drag/drop, status, dry-run, commit, and chat

## Roadmap

- Friendlier setup wizard
- One-click or guided Actual Budget deployment for new users
- Better review/edit workflow in the browser
- More Australian bank CSV/OCR profiles
- Stronger package/release flow for non-technical testers

## Contributing Test Cases

Use the GitHub CSV/OCR issue templates. Please sanitize examples before posting: replace names, account numbers, transaction IDs, amounts, and screenshots that reveal private information.

## Development

```bash
npm test
npm run web
```

Actual Budget stays the financial source of truth. AB Bot should sit beside it as a careful import and assistant layer.
