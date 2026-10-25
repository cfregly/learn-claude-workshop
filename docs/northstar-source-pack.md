# Northstar Freight synthetic source pack

This pack is fictional and safe for offline teaching. It contains no customer data, credentials, or external-system access.

Use only these four sources. Keep facts, synthesis, unknowns, and proposed actions separate. Do not send a message or change an external system.

## `crm-snapshot.md`

Source label: `CRM`

```text
Account: Northstar Freight
Account owner: Maya Chen
Annual contract value: $180,000
Renewal date: January 31, 2027
Current package: Growth
Next step field: blank
Discount request: 12 percent discussed, approval status blank
```

## `call-notes.md`

Source label: `CALL, October 14`

```text
October 14 call with Lena Ortiz, VP Operations, and Devon Price, IT.
Devon asked whether SSO is available. Lena asked for a renewal proposal by
November 15. No owner was assigned for the security follow-up. Maya wrote that
a 12 percent discount was discussed, but no approver or approval was recorded.
Do not use customer words or the Northstar name in public material.
```

## `support-summary.md`

Source label: `SUPPORT, October 13`

```text
Approved export dated October 13. Case 4821 concerns delayed shipment-alert
emails and remains open. Case 4794 concerned CSV export and closed October 2.
The export contains no pricing or SSO entitlement information.
```

## `usage-summary.md`

Source label: `USAGE, through October 13`

```text
Approved report through October 13. Northstar had 64 weekly active users in
the latest period and 78 in the prior period. This is usage data, not a stated
reason for the change and not a churn prediction.
```

## Shared workflow

1. Select approved account records.
2. Ask Claude for a source-bound draft.
3. Review the draft against the records.
4. Use the reviewed output in the existing process.

## Output contract

Produce five sections:

1. Confirmed facts with a source label after each item.
2. Synthesis labeled as synthesis.
3. Unknowns or conflicts that someone must resolve.
4. Proposed internal actions labeled as proposed.
5. A customer follow-up email marked `DRAFT`.

Run a source check on every number, date, product claim, and quotation. If a source is missing, remove the claim or move it to unknowns.
