# Northstar workshop facilitator guide

Northstar Freight is synthetic. These exercises describe prospective teaching designs. They do not claim prior delivery or learner results.

Everything in this guide works offline with the supplied source pack, traces, notebook, and repository ZIP. Do not enter credentials, call a live API, send messages, change external systems, install packages, commit, or push.

## Universal teaching sequence

Use this sequence in every path:

1. Start with a familiar task.
2. Explain the new idea in plain language.
3. Demonstrate one complete pass.
4. Connect the result to the learner's work or business value.
5. Check learning with a changed input, decision, or short teach-back.

Give a blocked learner a finished reference and an exact rejoin checkpoint. Give a faster learner an optional validation or edge case from the same checkpoint.

When a question is ambiguous, restate the point briefly and ask whether the interpretation is right. Do not use the same restatement opener for every question.

## Common starting point

Before learners branch by role, ask them to identify these four steps:

1. Select approved account records.
2. Ask Claude for a source-bound draft.
3. Review the draft against the records.
4. Use the reviewed output in the existing process.

Do not add product or API depth until the room can identify the common path.

## Four-minute mixed-room activity

Announce both routes and the rejoin time before the activity begins. Learners may choose the route that matches their learning need.

### Engineer route

Trace the saved notebook request and response. Locate the application account-access check that runs before Northstar facts enter the request. If time remains, use the prepared extension to identify the terminal stream state.

### Account Executive route

Compare the draft brief with the source notes. Mark which customer claims are supported and reject the unapproved discount. Choose the next customer question.

### Rejoin checkpoint

At four minutes, one engineer explains one integration step. One Account Executive explains one customer conclusion and its evidence. The unapproved discount anchors both explanations.

Use the responses to decide whether to continue or revisit a missing concept.

## Visible parking lot

Keep deeper questions visible. Use four fields:

| Question | Owner | Return time | Status |
| --- | --- | --- | --- |
| Short learner wording | Facilitator or named participant | Exact agenda checkpoint | Open, answered, or moved to follow-up |

State the return time when parking a question. At the checkpoint, answer it, assign a follow-up, or explain why it is outside the learning objective. Do not let the parking lot become a hidden backlog.

## Recovery pattern

1. Preserve the error or confusing output.
2. Classify the boundary, such as source, access, request, stream, tool, test, or review.
3. Open the matching annotated brief, event trace, tool trace, transcript, architecture, scorecard, or reference diff.
4. Ask the learner to explain one step.
5. Rejoin at the announced checkpoint.

Faster learners work a related changed case while the common path is restored. Bring their result back only when it helps the shared objective.

## Ten path agendas

### Account Executive, 45 minutes

- 5 minutes: Frame the renewal decision and inspect three source notes.
- 7 minutes: Order the shared workflow from approved records to reviewed output.
- 8 minutes: Demonstrate the source-linked brief.
- 10 minutes: Classify claims in pairs.
- 7 minutes: Work the changed-date case.
- 6 minutes: Teach back the value, boundary, and next question.
- 2 minutes: Complete the exit ticket.

Reference: annotated source-linked brief and completed workflow sequence.

Optional validation: preserve conflicting renewal dates and choose the next question.

### COO / Executive, 20 minutes

- 3 minutes: Name the funding decision.
- 4 minutes: Sequence the shared Northstar workflow.
- 5 minutes: Compare a useful draft with an unsafe draft.
- 5 minutes: Complete and defend the pilot card with scope, resources, spending limit, named owner, and review date.
- 3 minutes: Apply the changed cost and owner case.

Reference: completed pilot decision card with the decision, evidence still needed, and next owner.

Optional validation: revisit the decision after cost doubles and the support owner changes.

### Revenue Operations, 30 minutes

- 4 minutes: Frame the CRM handoff.
- 5 minutes: Order records, draft, review, and existing process.
- 6 minutes: Demonstrate the field and exception map.
- 8 minutes: Complete the mapping exercise.
- 5 minutes: Apply the missing-support case.
- 2 minutes: Teach back the safest routing rule.

Reference: completed field map with an audit trail.

Optional validation: remove support access and route the gap without inventing a value.

### Marketing, 25 minutes

- 3 minutes: Frame the evidence-backed drafting task.
- 5 minutes: Sequence source selection, draft, review, and use.
- 6 minutes: Demonstrate the claim worksheet.
- 7 minutes: Review and revise the draft.
- 4 minutes: Apply the removed-source challenge.

Reference: worksheet with one accepted and one rejected claim.

Optional validation: remove the usage source and revise the allowed copy.

### Product manager, 30 minutes

- 4 minutes: Name the user problem and decision.
- 5 minutes: Order the common workflow.
- 6 minutes: Compare two product behaviors.
- 8 minutes: Write the pilot requirement.
- 5 minutes: Apply the access and conflict case.
- 2 minutes: Defend proceed, revise, or stop.

Reference: completed requirement with a missing-support check.

Optional validation: combine missing support access with a conflicting usage signal.

### Solutions architect for the direct Claude API, 45 minutes

- 5 minutes: Frame the architecture decision.
- 8 minutes: Sequence the common account workflow.
- 10 minutes: Annotate account access, approved context, direct API behavior, and review boundaries.
- 10 minutes: Distinguish network, API permission, and incorrect-context failures.
- 8 minutes: Work the stale-source challenge.
- 4 minutes: Defend the recommendation and next test.

Reference: annotated architecture, known-good direct API request, and troubleshooting checklist. The recommendation names the main tradeoff, a test that exposes a bad assumption, and the first inspection after failure.

Optional validation: diagnose a stale-data trace or alternate network evidence packet. Add private connectivity or retrieval only when customer constraints require it.

### Software engineer for the Claude API, 45 minutes

- 4 minutes: Inspect the synthetic notes and name forbidden inventions.
- 6 minutes: Sequence records, request, review, and existing process.
- 6 minutes: Trace the typed request and illustrative response.
- 7 minutes: Repair the mocked stream handler.
- 8 minutes: Trace the read-only tool loop.
- 6 minutes: Classify errors and stop reasons.
- 5 minutes: Work the combined trace challenge.
- 3 minutes: Teach back one boundary and one fix.

Reference: annotated request, illustrative typed response, saved text-delta code, completed tool trace, and error decision card.

Optional validation: combine conflicting dates with a `max_tokens` stop.

### Applied AI engineer, 40 minutes

- 5 minutes: Define the real task and critical failures.
- 7 minutes: Map the common workflow to evaluation points.
- 10 minutes: Score the four fixtures.
- 8 minutes: Compare quality and telemetry.
- 6 minutes: Work the combined failure case.
- 4 minutes: Defend the release decision.

Reference: scored baseline and edge-case rubric.

Optional validation: add a conflict plus truncation fixture and decide whether to release it.

### Engineering manager for Claude Code, 30 minutes

- 4 minutes: Frame the business effect of the missing account.
- 6 minutes: Trace requirement, predicate, and tests.
- 8 minutes: Review failing test, fix, suite, and diff.
- 7 minutes: Build the team pilot card.
- 5 minutes: Reject or split the broader diff.

Reference: acceptance criteria, failing and passing transcript, and minimal diff.

Optional validation: reject unrelated edits in a passing diff.

### Knowledge worker with Project and optional Cowork, 30 minutes

- 4 minutes: Inspect the four synthetic files.
- 5 minutes: Order the shared workflow.
- 7 minutes: Demonstrate the five-section brief.
- 8 minutes: Draft and run the source check.
- 4 minutes: Apply the missing-support challenge.
- 2 minutes: Teach back the review boundary.

Reference: worked five-section brief.

Optional validation: remove the support file and preserve the access gap.
