# AB Bot Architecture

AB Bot is a companion app for Actual Budget, not a replacement budgeting engine.

```plaintext
Bank CSV / Screenshot
        |
        v
Ingestion pipeline
        |
        v
Review and correction
        |
        v
Actual Budget API package
        |
        v
Actual Budget file and sync server
```

## Key Decisions

- Actual Budget remains the source of truth for accounts, categories, rules, transactions, and envelope budgeting.
- AB Bot stores only companion configuration: import profiles, review state, AI provider settings, and ingestion logs.
- Transaction writes go through `@actual-app/api` and should prefer `importTransactions` so Actual can run its reconciliation and rules.
- Every import should produce a human-reviewable canonical transaction before it can be committed.
- AI features query structured tools. The model should not infer budget state from screenshots, prose, or raw CSV when structured data exists.

## Canonical Transaction

```json
{
  "date": "2026-05-01",
  "description": "WOOLWORTHS 1234",
  "amount": -42.3,
  "account": "Everyday",
  "external_id": "abc123",
  "category": null
}
```

## Suggested MVP

1. CSV import preview
2. Saved bank mapping profiles
3. Review and edit screen
4. Dry-run Actual import
5. Commit import to Actual
6. Budget summary tools for AI
7. First local or cloud AI provider

## Actual Budget Integration Notes

Actual Budget's documented integration path is the official Node.js package, `@actual-app/api`. It is not a REST API. The API client works against a local copy of the budget data and can connect to an Actual server to download and sync a budget.

For normal bank-style transaction ingestion, AB Bot should call `importTransactions(accountId, transactions, opts)` instead of directly inserting rows. That lets Actual apply rules, reconcile likely duplicates, and use `imported_id` when available.
