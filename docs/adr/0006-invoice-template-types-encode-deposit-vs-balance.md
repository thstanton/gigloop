# ADR-0006: Invoice template types encode deposit vs balance distinction

## Status
Accepted

## Context
Invoices in GigMan have an `isDeposit` flag. A booking typically has two invoices: a deposit invoice sent early to secure the date, and a balance invoice sent before the performance. These require different email copy ("please find your deposit invoice" vs "please find your final balance invoice").

An earlier design had a single `invoice_cover` template for sending any invoice, with a runtime invoice picker in the compose flow. This created a risk: if a musician skipped sending the deposit invoice and later tried to catch up, they could accidentally select the balance invoice thinking it was the deposit — sending a larger, premature bill to the client.

## Decision
The template type itself encodes the invoice type:

- `deposit_invoice_cover` — always attaches the invoice where `isDeposit === true`
- `balance_invoice_cover` — always attaches the invoice where `isDeposit === false`
- `contract_and_deposit_cover` — attaches the deposit invoice alongside the contract portal link

The generic `invoice_cover` type is not used. No invoice picker exists in the compose flow — the musician's template choice determines which invoice is attached.

## Consequences
- Prevents accidental early sending of the balance invoice
- Email copy is specific and appropriate to the invoice type without manual editing
- If a booking has no deposit invoice, `deposit_invoice_cover` and `contract_and_deposit_cover` are hidden from the template picker in the compose flow
- Adding new invoice variants (e.g. a retainer invoice) would require a new template type — this is acceptable for MVP
