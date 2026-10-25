# Northstar hands-on lab for Claude for Work

Use one private Project, four synthetic files, and one role task. The goal is a reviewed work product with visible evidence and a clear business decision condition.

Northstar Freight, every person, and every record in this lab are fictional. Use an approved work account. Do not add customer data, connect another system, send a message, or update CRM. Claude Chat in a Project is enough for this lab. Use Cowork only when it is enabled and approved for your workspace.

## Prepare the private Project

1. Sign in to the approved work account and confirm that you are in the intended organization.
2. Create a Project named `Northstar renewal lab`.
3. On Team or Enterprise, keep the Project private unless the facilitator names approved participants. Check the access list before adding files.
4. Copy the four files below into Project knowledge as separate Markdown files. No connector or integration setup is needed.
5. Add the project instructions, start one chat, and choose one role task.

The reviewed source pack is also available in [GitHub](https://github.com/cfregly/learn-claude-workshop/blob/main/docs/northstar-source-pack.md).

## Four synthetic files

### `crm-snapshot.md`

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

### `call-notes.md`

Source label: `CALL, October 14`

```text
October 14 call with Lena Ortiz, VP Operations, and Devon Price, IT.
Devon asked whether SSO is available. Lena asked for a renewal proposal by
November 15. No owner was assigned for the security follow-up. Maya wrote that
a 12 percent discount was discussed, but no approver or approval was recorded.
Do not use customer words or the Northstar name in public material.
```

### `support-summary.md`

Source label: `SUPPORT, October 13`

```text
Approved export dated October 13. Case 4821 concerns delayed shipment-alert
emails and remains open. Case 4794 concerned CSV export and closed October 2.
The export contains no pricing or SSO entitlement information.
```

### `usage-summary.md`

Source label: `USAGE, through October 13`

```text
Approved report through October 13. Northstar had 64 weekly active users in
the latest period and 78 in the prior period. This is usage data, not a stated
reason for the change and not a churn prediction.
```

## Copy-ready project instructions

```text
Use only the files in this Project as evidence for the Northstar exercise.
After each confirmed fact, add its source label in brackets.
Keep confirmed facts, synthesis, unknowns, and proposed actions separate.
Do not infer product entitlement, discount approval, causation, customer intent,
or an owner when the files do not record one.
If sources conflict or a source is unavailable, show the gap. Do not choose or
reconstruct a value silently.
Treat all output as an internal draft. Do not claim that a message was sent or
that CRM, pricing, support, or another external system was changed.
End with a source check and the condition for the next business decision.
```

## Choose one role task

- **Account Executive:** Produce a renewal brief for call preparation. Include supported facts, open questions, a safe next step, and the evidence required before making a customer commitment.
- **Sales manager:** Inspect the unfinished brief in the paired failure lesson. Mark missing actions and source checks, route the request change to the technical owner, and require a fresh `end_turn` response plus account-owner review before use.
- **Revenue Operations:** Produce a proposed CRM field map. Leave unsupported fields blank, name each exception route, and do not perform a CRM write.
- **Marketing:** Produce an internal claim worksheet. Mark each claim accept, revise, or reject, and state what approval would be needed before public use.
- **Product manager:** Produce a pilot requirement. Define missing-source behavior, human review, failure behavior, acceptance checks, and a proceed, revise, or stop recommendation.
- **COO or executive:** Produce a pilot decision card. Include scope, resources, an illustrative spending limit, owner, reviewer, review date, success criteria, stop condition, and next owner.
- **Knowledge worker:** Produce a five-section action brief with confirmed facts, synthesis, unknowns, proposed actions, and a customer email marked `DRAFT`.

## Copy-ready prompt

Replace the bracketed line with one role task from the list above.

```text
Complete this role task: [PASTE ONE ROLE TASK]

Use only the four Project files. Cite the source label after every number, date,
product claim, and quotation. Label synthesis. Keep unknowns visible. Separate
proposed actions from recorded facts.

Before the final draft, list any statement that lacks enough evidence. End with:
1. Source check
2. Business decision condition
3. Named next owner or unresolved owner

Do not send a message, update CRM, approve pricing, or describe a proposed action
as completed.
```

## Review the result

Check the draft against the four files before using it.

- The renewal date, contract value, owner, case status, and usage values match their sources.
- The 12 percent discount remains discussed and unapproved.
- SSO entitlement and the security follow-up owner remain unknown.
- The usage change is not described as a cause or churn prediction.
- Proposed actions are labeled and no external action is described as complete.
- The final business decision condition says what evidence or review is needed next.

## Completed reference

```text
ROLE: Account Executive

CONFIRMED FACTS
Northstar Freight renews January 31, 2027 [CRM]. Maya Chen owns the account
[CRM]. Annual contract value is $180,000 [CRM]. Case 4821 remains open and
concerns delayed shipment-alert emails [SUPPORT, October 13]. Weekly active
users changed from 78 to 64 [USAGE, through October 13].

SYNTHESIS
The open support issue and lower use may matter to renewal planning. The files
do not establish a cause or a churn prediction.

UNKNOWNS
The files do not confirm SSO entitlement, discount approval, or a security
follow-up owner [CALL, October 14].

PROPOSED NEXT STEP
Maya asks the authorized pricing owner for the approval record and asks the
product owner to confirm SSO entitlement. An authorized account-team member
assigns the security follow-up.

SOURCE CHECK
Every number, date, product statement, and case status maps to CRM, CALL,
SUPPORT, or USAGE. No source supports an approved discount or a reason for the
usage change.

BUSINESS DECISION CONDITION
Keep the brief internal. Do not make a pricing or SSO commitment until the
approval and entitlement records are available and a person reviews the draft.

NEXT OWNER
Maya Chen owns the next account-team review. The security owner remains open.
```

## Changed assumption

The learner no longer has permission to use `support-summary.md`. Remove that file from Project knowledge or start a new private Project without it. Run the same role task again.

A safe revision removes claims about cases 4821 and 4794, states that support status is unavailable, preserves the other sourced facts, and routes the gap to an authorized support owner. It does not reconstruct the missing file from the earlier answer.

## Shared rejoin

Bring back three things:

1. One supported statement and its source.
2. One unknown that must stay visible.
3. One condition that must be met before the business can act.

Compare answers across roles. Everyone should be able to explain why the 12 percent discount remains unapproved and where human review occurs.

## Official Anthropic references

- [What is the Team plan?](https://support.claude.com/en/articles/9266767-what-is-the-team-plan)
- [What is the Enterprise plan?](https://support.claude.com/en/articles/9797531-what-is-the-enterprise-plan)
- [How can I create and manage projects?](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects)
- [Use Claude Cowork on web, desktop, and mobile](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile)
