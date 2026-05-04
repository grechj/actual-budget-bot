# Phase 2: Review and Actual Import

Phase 2 turns CSV parsing into a safer import workflow.

## Workflow

1. Save a reusable mapping profile.
2. Create a review file from a bank CSV.
3. Review and edit the generated JSON file.
4. Approve rows that should be imported.
5. Run an Actual Budget dry-run import.
6. Commit the import only after the dry run looks right.

## Saved Mapping Profiles

Save a mapping profile into `.ab-bot/profiles`:

```bash
node src/cli.js profile:save commbank-no-header --mapping examples/mappings/no-header-date-amount-description-balance.json
```

List saved profiles:

```bash
node src/cli.js profile:list
```

Use a saved profile:

```bash
node src/cli.js csv:preview ./transactions.csv --profile commbank-no-header --summary
```

## Review Files

Create a review file:

```bash
node src/cli.js csv:review ./transactions.csv --profile commbank-no-header
```

Show a short review summary:

```bash
node src/cli.js review:summary .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --limit 10
```

Approve all non-rejected rows:

```bash
node src/cli.js review:approve-all .ab-bot/reviews/review-YYYYMMDDHHMMSS.json
```

Rows can also be edited manually in the review file:

```json
{
  "review": {
    "status": "approved",
    "notes": null
  }
}
```

Supported row statuses:

```plaintext
pending
approved
rejected
```

## Actual Budget Dry Run

Actual integration uses the official `@actual-app/api` package. Actual does not expose a REST API for this use case.

Install the Actual API package when package tooling is available:

```bash
npm install @actual-app/api
```

Configure Actual connection values:

```bash
export AB_BOT_DATA_DIR=.ab-bot/actual-data
export ACTUAL_SERVER_URL=http://localhost:5006
export ACTUAL_PASSWORD=...
export ACTUAL_BUDGET_ID=...
```

List accounts:

```bash
node src/cli.js actual:accounts
```

Dry-run import approved rows:

```bash
node src/cli.js actual:dry-run .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --account-id ACCOUNT_ID
```

By default this prints counts only. To include Actual transaction IDs in the result:

```bash
node src/cli.js actual:dry-run .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --account-id ACCOUNT_ID --ids
```

## Actual Budget Commit

Commit requires an explicit `--yes` flag:

```bash
node src/cli.js actual:commit .ab-bot/reviews/review-YYYYMMDDHHMMSS.json --account-id ACCOUNT_ID --yes
```

Use `--ids` on commit only when you need the generated Actual transaction IDs in the terminal output.

The Actual API call uses:

```json
{
  "dryRun": false,
  "defaultCleared": true,
  "reimportDeleted": false
}
```

`reimportDeleted` is set to `false` to match Actual's file-import UI default and avoid unexpectedly reimporting rows a user deleted earlier.
