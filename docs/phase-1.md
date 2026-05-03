# Phase 1: CSV Import Preview

Phase 1 makes AB Bot useful before it can write to Actual Budget.

## Acceptance Criteria

- A bank CSV can be previewed without modifying any budget data.
- AB Bot can infer common column names for date, description, amount, debit, credit, account, and external ID.
- Users can provide a reusable JSON mapping profile when inference is wrong.
- Every row becomes a canonical transaction shape.
- Preview output includes duplicate candidates and row-level validation issues.
- The import preview is deterministic, testable, and safe to show in a future UI.

## Preview Command

```bash
node src/cli.js csv:preview ./transactions.csv
```

With an explicit mapping profile:

```bash
node src/cli.js csv:preview ./transactions.csv --mapping ./examples/mappings/example-bank.json
```

## Preview Output

The command returns:

- `header`: detected CSV headers
- `mapping`: inferred or supplied column mapping
- `transactions`: canonical transactions
- `duplicates`: duplicate candidates within the import batch
- `issues`: row-level validation messages
- `summary`: import counts

## Canonical Transaction

```json
{
  "date": "2026-05-01",
  "description": "WOOLWORTHS 1234",
  "amount": -42.3,
  "account": null,
  "external_id": "abc123",
  "category": null,
  "source": {
    "type": "csv",
    "rowNumber": 2
  }
}
```
