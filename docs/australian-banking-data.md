# Australian Banking Data Structures

This note captures public data-shape research for AB Bot's Australian banking import layer.

## Takeaways

- Australian Open Banking is delivered through the Consumer Data Right (CDR).
- CDR is useful as the reference shape for bank transaction data, even when users are uploading CSVs manually.
- CSV exports vary by institution and often contain less data than CDR.
- AB Bot should keep a small canonical transaction model, but preserve richer source metadata when available.
- Pending transactions should be treated cautiously and reviewed before import.

## CDR / Open Banking Transaction Shape

The current CDR Banking API transaction list response returns `BankingTransactionV2` objects.

Important fields:

```json
{
  "accountId": "string",
  "transactionId": "string",
  "isDetailAvailable": true,
  "type": "DIRECT_DEBIT",
  "status": "POSTED",
  "description": "string",
  "postingDateTime": "string",
  "valueDateTime": "string",
  "executionDateTime": "string",
  "amount": "string",
  "currency": "AUD",
  "reference": "string",
  "merchantName": "string",
  "merchantCategoryCode": "string",
  "instalmentPlanId": "string",
  "billerCode": "string",
  "billerName": "string",
  "crn": "string",
  "apcaNumber": "string"
}
```

CDR transaction types:

```plaintext
DIRECT_DEBIT
FEE
INTEREST_CHARGED
INTEREST_PAID
OTHER
PAYMENT
TRANSFER_INCOMING
TRANSFER_OUTGOING
```

CDR transaction statuses:

```plaintext
PENDING
POSTED
```

CDR amount convention:

- Negative amount means money leaves the account.
- Positive amount means money enters the account.

## Basiq Transaction Shape

Basiq exposes a practical aggregator model that includes both bank-provided data and optional enrichment.

Important fields:

```json
{
  "type": "transaction",
  "id": "string",
  "status": "posted",
  "description": "string",
  "postDate": "2017-08-01T00:00:00Z",
  "transactionDate": "",
  "amount": "-139.98",
  "balance": "356.50",
  "direction": "debit",
  "class": "payment",
  "subClass": {
    "code": "722",
    "title": "Travel Agency and Tour Arrangement Services"
  },
  "account": "string",
  "institution": "string",
  "connection": "string",
  "enrich": null
}
```

Basiq debit classes include:

```plaintext
bank-fee
payment
cash-withdrawal
transfer
loan-interest
```

Basiq credit classes include:

```plaintext
refund
direct-credit
interest
transfer
loan-repayment
```

Basiq enrichment can add:

- merchant
- location
- category
- links/logos

## Recommended AB Bot Canonical Model

Keep the current simple model as the import target:

```json
{
  "date": "YYYY-MM-DD",
  "description": "string",
  "amount": 0,
  "account": "string|null",
  "external_id": "string|null",
  "category": "string|null"
}
```

Add optional source metadata for richer imports:

```json
{
  "source": {
    "type": "csv|cdr|basiq|ocr",
    "rowNumber": 2,
    "institution": "string|null",
    "accountId": "string|null",
    "status": "posted|pending|POSTED|PENDING|null",
    "reference": "string|null",
    "balance": "string|null",
    "transactionType": "string|null",
    "merchantName": "string|null",
    "merchantCategoryCode": "string|null"
  }
}
```

## CSV Mapping Implications

AB Bot should recognise these likely Australian banking column concepts:

| Canonical field | Common CSV names | CDR/Basiq equivalents |
| --- | --- | --- |
| `date` | Date, Transaction Date, Posted Date, Value Date | `postingDateTime`, `valueDateTime`, `executionDateTime`, `postDate`, `transactionDate` |
| `description` | Description, Details, Narrative, Transaction Details, Merchant | `description`, `merchantName` |
| `amount` | Amount, Transaction Amount, Debit/Credit signed amount | `amount` |
| `debit` | Debit, Withdrawals, Money Out | negative `amount`, `direction=debit` |
| `credit` | Credit, Deposits, Money In | positive `amount`, `direction=credit` |
| `balance` | Balance, Running Balance, Account Balance | Basiq `balance` |
| `external_id` | Transaction ID, Reference, Receipt, Fit ID | CDR `transactionId`, `reference`, Basiq `id` |
| `account` | Account, Account Name, Account Number | CDR `accountId`, Basiq `account` |

Headerless Australian CSV exports are also common. AB Bot already supports profiles such as:

```json
{
  "hasHeader": false,
  "mapping": {
    "date": "Column 1",
    "amount": "Column 2",
    "description": "Column 3"
  }
}
```

## Future Product Implications

- Phase 2 should preserve source metadata during review, even if Actual Budget only receives date, amount, payee, category, and imported ID.
- Duplicate detection should prefer external IDs when available. For CSVs without IDs, use the current stable hash fallback.
- Pending Open Banking/Basiq transactions should be excluded by default or clearly marked as pending because they can change.
- Category suggestions should not rely on CDR `type` alone; the standards deliberately leave transaction type interpretation to data holders.
- If AB Bot later supports Basiq or direct CDR ingestion, that should be an optional connector path. CSV should remain first-class and local-first.

## Sources

- [Australian Banking Association: Open Banking](https://www.ausbanking.org.au/priorities/open-banking/)
- [Data Standards Body: Data Standards](https://dsb.gov.au/consumer-data-right/data-standards)
- [Consumer Data Standards: BankingTransactionV2](https://consumerdatastandardsaustralia.github.io/standards/#tocSbankingtransactionv2)
- [CDR Postman collection: Get Transactions For Account](https://www.postman.com/postman/open-banking-australia-cdr/request/41n6pyx/get-transactions-for-account)
- [Consumer Data Standards Support: BankingTransaction guidance](https://cdr-support.zendesk.com/hc/en-us/articles/10994916162319-Guidance-on-BankingTransaction)
- [Basiq API: Transactions](https://api.basiq.io/v2.1/reference/transactions)
- [Basiq API: Accounts](https://api.basiq.io/v2.1/reference/accounts)
- [Basiq API: List all transactions](https://api.basiq.io/v2.1/reference/list-all-transactions)
