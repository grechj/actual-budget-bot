# Phase 3: Budget Tools, Category Suggestions, and First AI Provider

Phase 3 adds read-only analysis tools on top of the Phase 2 import workflow.

## Budget Summary

Summarise Actual transactions for an account and date range:

```bash
node src/cli.js actual:summary --account-id ACCOUNT_ID --start-date 2026-01-01 --end-date 2026-01-31
```

This reads committed transactions from Actual. If you have only run `actual:dry-run`, the Actual summary will still be empty because dry-run does not write rows.

The summary includes:

- total income
- total spending
- net movement
- spending grouped by category
- spending grouped by payee

Summarise an uncommitted review file:

```bash
node src/cli.js review:insights .ab-bot/reviews/review-YYYYMMDDHHMMSS.json
```

For summary-only output:

```bash
node src/cli.js review:insights .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --limit 0
```

## Category Suggestions

Suggest categories for a review file using historical Actual transactions:

```bash
node src/cli.js category:suggest .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --account-id ACCOUNT_ID --start-date 2025-01-01 --end-date 2026-01-31 --limit 20
```

The first version is deterministic. It normalises merchant descriptions and matches them against previously categorised transactions.

You can also use local rules without committed Actual history:

```bash
node src/cli.js category:suggest .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --rules examples/category-rules/australia-basic.json --limit 20
```

It does not write categories back to the review file yet.

## First AI Provider

AB Bot has a small provider registry.

List providers:

```bash
node src/cli.js ai:providers
```

Current providers:

```plaintext
disabled
openai
anthropic (registered, not implemented)
ollama (registered, not implemented)
```

The first implemented cloud provider is OpenAI via the Responses API. It uses Node's built-in `fetch`, so no extra OpenAI SDK package is required.

It is optional and requires:

```bash
export OPENAI_API_KEY="your-api-key"
export AB_BOT_AI_PROVIDER=openai
export AB_BOT_AI_MODEL=gpt-5.2
```

Ask a budget question:

```bash
node src/cli.js ai:ask "What should I pay attention to this month?" --account-id ACCOUNT_ID --start-date 2026-01-01 --end-date 2026-01-31
```

Or choose the provider/model per command:

```bash
node src/cli.js ai:ask "What should I pay attention to this month?" --account-id ACCOUNT_ID --start-date 2026-01-01 --end-date 2026-01-31 --provider openai --model gpt-5.2
```

The AI command sends a structured budget context to OpenAI. Do not run it against real financial data unless you are comfortable transmitting that summary to OpenAI.

## Design Notes

- Budget tools are read-only.
- Category suggestions are deterministic before AI-assisted categorisation.
- AI advice is advisory only.
- AI commands should use structured summaries instead of raw CSVs where possible.

## Sources

- [OpenAI text generation guide](https://platform.openai.com/docs/guides/text?api-mode=responses)
- [OpenAI Responses API reference](https://platform.openai.com/docs/api-reference/responses/create?api-mode=responses)
- [OpenAI JavaScript SDK docs](https://platform.openai.com/docs/libraries/javascript)
