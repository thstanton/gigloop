# Contract send is decoupled from deposit-invoice creation

The checklist item `send_contract` ("Send contract & deposit email") deliberately
depends only on `create_contract` — **not** on `create_deposit_invoice`. We will
not couple them, even though the label mentions the deposit.

## Why this is out of scope

Sending a contract **without** a deposit ask is a first-class, intentional path,
so the deposit invoice must stay optional at contract-send time. The product
supports two contract cover emails (`apps/web/src/features/templates/templateMeta.ts`):

- `contract_cover` — *"sending only the contract link"* (no deposit)
- `contract_and_deposit_cover` — contract link **plus** a deposit invoice reference

`send_contract` auto-completes on **either** of them
(`apps/api/src/bookings/checklist-defaults.ts` — its `autoCompleteRule.templateTypes`
is `['contract_cover', 'contract_and_deposit_cover']`). The compose flow never
requires an invoice to exist: `contract_cover` carries no invoice, and even
`contract_and_deposit_cover` sends with only a soft "no deposit invoice to attach"
warning — it is never blocked. The default template shortcut already adapts to the
workflow (deposit vs non-deposit) based on whether the `deposit_received` checklist
item is present, not on whether an invoice exists.

Making `create_deposit_invoice` a hard `dependsOn` of `send_contract` would force
deposit-invoice creation on **every** booking before the contract could go out,
breaking the contract-only workflow for musicians who don't take deposits. The real
prerequisite for sending the contract is the contract itself, which is already the
dependency.

```ts
// checklist-defaults.ts — the dependency is correct as-is:
{
  key: 'send_contract',
  label: 'Send contract & deposit email',
  dependsOn: ['create_contract'],           // NOT ['create_contract', 'create_deposit_invoice']
  autoCompleteRule: {
    type: 'communicationSent',
    templateTypes: ['contract_cover', 'contract_and_deposit_cover'], // either satisfies it
  },
  // …
}
```

Consequently the Smart Reminders "after you …" dependency clause for `send_contract`
correctly reads *"after you create the contract"* and should not mention the deposit
invoice.

If a future requirement is that non-deposit workflows should never even *see* the
`contract_and_deposit_cover` option, that is a UI-side template-filtering change — not
a dependency-graph change.

## Prior requests

- #566 — "Should `send_contract` depend on `create_deposit_invoice`? (checklist dependency graph)"
