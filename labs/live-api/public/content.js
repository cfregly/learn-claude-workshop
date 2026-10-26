// Exact public teaching fields used by the workshop backend.
export const paths = [
  {
    "id": "account-executive",
    "title": "Account Executive: Build a trusted renewal brief",
    "category": "Business",
    "task": "Prepare a source-linked Northstar renewal brief for Maya Chen before the customer call.",
    "outcome": "The learner can trace the brief to approved sources, distinguish fact, synthesis, unknown, and unsupported claim, explain one permission boundary, and choose a safe next action.",
    "explanation": "The application checks which Northstar records the employee may read. Its server holds the Claude API credential and sends only approved records.\n\nYou review the resulting draft against those records. Separate supported facts, interpretation, unknowns, and unsupported claims. A finished response does not approve pricing or entitlement.\n\nThe engineer inspects the same integration and its failures. Your evidence is a source-checked brief and a safe next action. Claude for Work is available as an alternate exercise.",
    "exercise": {
      "reference": "FACT AND SOURCE: Renewal January 31, 2027 and owner Maya Chen [CRM]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The support issue and lower use may matter, with no evidence of cause or churn. UNKNOWN: SSO entitlement and security owner. UNSUPPORTED CLAIM REMOVED: The 12 percent discount is approved. NEXT CUSTOMER QUESTION: Who owns the security follow-up? SAFE NEXT ACTION: Maya confirms package and pricing details internally before using the brief."
    }
  },
  {
    "id": "executive",
    "title": "COO / Executive: Decide on a bounded pilot",
    "category": "Leadership",
    "task": "Decide whether to fund a limited renewal-brief pilot for one team and close with a concrete operating plan.",
    "outcome": "The learner can authorize, revise, defer, or stop a pilot and state the decision, required evidence, and next owner.",
    "explanation": "The COO or executive does not need to inspect API fields. The decision is whether the workflow is worth testing, what resources it needs, who owns it, what evidence matters, and what would stop it.",
    "exercise": {
      "reference": "DECISION: Proceed with an internal offline pilot only. SCOPE: Five synthetic variants with no customer-facing use. OWNER: Jordan Lee, fictional pilot owner. REVIEWERS: Maya Chen and Priya Shah, fictional account reviewers. RESOURCES: One engineer, the offline fixture set, a review scorecard, and reviewer time. SPENDING LIMIT: $100 illustrative cap for the exercise, not real authorized spend. REVIEW DATE: November 6, 2026. QUALITY CRITERIA: Five of five variants preserve critical fields and produce zero unsupported commitments. TIME CRITERION: Preparation plus correction is 12 minutes or less per brief, with reviewer effort recorded. STOP CONDITION: Any invented commitment, missing source check, or skipped reviewer stops the pilot. NEXT OWNER: Jordan Lee compiles the evidence for Avery Brooks, fictional COO, who decides whether to revise, stop, or expand."
    }
  },
  {
    "id": "sales-manager",
    "title": "Sales manager: Review an incomplete renewal brief",
    "category": "Leadership",
    "task": "Review the unfinished Northstar brief, identify what is missing, and assign source checks and next actions before the team uses it for account planning.",
    "outcome": "The learner can recognize an unfinished brief, withhold unsupported claims, and route source review and next actions to Maya Chen and the right specialist.",
    "explanation": "A readable fragment is not ready for account planning. Mark where it stops, then list the missing facts, decisions, owners, and next actions. Keep supported facts, but do not complete the sentence or infer why usage fell. The technical owner repairs the brief-producing workflow and returns a complete draft. Maya Chen checks each claim against the CRM, call, support, and usage records before anyone uses it.",
    "exercise": {
      "reference": "The brief is unfinished. Keep the January 31, 2027 renewal date, Maya Chen as account owner, and the usage numbers because their cited records support them. Do not complete the sentence Case 4821 is or infer why usage fell.\n\nWithhold the brief from account planning. The missing items are the full support status, the 12% discount decision, SSO entitlement, owners, next actions, and Maya's source review.\n\nAssign the repair to the technical owner, who returns a complete draft. The support owner confirms that Case 4821 remains open and records the next support step.\n\nMaya checks the renewal date, Case 4821, and the change from 78 to 64 weekly active users against CRM, SUPPORT, and USAGE. She keeps the cause unknown. She asks the pricing owner for discount approval evidence and the solutions owner for the SSO record. Until those arrive, both fields stay unknown.\n\nThe brief may enter account planning only after every required section has an owner and supported claims pass Maya's review. Rejoin at Business value and practice."
    }
  },
  {
    "id": "revenue-operations",
    "title": "Revenue Operations: Route facts, blanks, and exceptions",
    "category": "Business",
    "task": "Prepare proposed CRM updates and exception routes for the Northstar renewal handoff.",
    "outcome": "The learner can draft safe field updates, preserve unknowns, and route each exception to an owner.",
    "explanation": "Claude can draft a field map from approved sources. Revenue Operations decides which fields may be proposed, which must remain blank, and where unresolved items go next.",
    "exercise": {
      "reference": "FIELD renewal_date, VALUE 2027-01-31, SOURCE CRM, STATUS supported. FIELD account_owner, VALUE Maya Chen, SOURCE CRM, STATUS supported. FIELD support_case, VALUE 4821 open, SOURCE SUPPORT, STATUS supported. FIELD weekly_active_users, VALUE 64 with prior value 78, SOURCE USAGE, STATUS supported. FIELD sso_entitlement, VALUE blank, STATUS needs owner, ROUTE product specialist. FIELD discount_approval, VALUE blank, STATUS needs owner, ROUTE commercial approver. FIELD security_owner, VALUE blank, STATUS needs owner, ROUTE Maya Chen. REVIEWER Maya Chen. No CRM write is part of the exercise."
    }
  },
  {
    "id": "marketing",
    "title": "Marketing: Keep every claim tied to evidence",
    "category": "Business",
    "task": "Prepare an internal messaging draft and a claim-to-source worksheet from the Northstar records.",
    "outcome": "The learner can accept, revise, or reject a claim and explain the source and approval needed for public use.",
    "explanation": "Claude can help organize and draft. Marketing still checks whether each claim is supported, whether customer words may be used, and whether an approval path exists.",
    "exercise": {
      "reference": "ROW 1: Weekly active users changed from 78 to 64. SOURCE: USAGE. TYPE: fact. USE: internal. DECISION: accept. ROW 2: Case 4821 remains open. SOURCE: SUPPORT. TYPE: fact. USE: internal. DECISION: accept. ROW 3: Northstar is at churn risk. SOURCE: none. DECISION: reject. ROW 4: The 12 percent discount is approved. SOURCE: none. DECISION: reject. ROW 5: Northstar praised the product. SOURCE: none and no public-use approval. DECISION: reject. Public copy omits the customer name and customer words."
    }
  },
  {
    "id": "product-manager",
    "title": "Product manager: Define useful and testable behavior",
    "category": "Leadership",
    "task": "Define a pilot for an evidence-backed renewal brief inside the account workflow.",
    "outcome": "The learner can write a bounded requirement, acceptance checks, and a proceed, revise, or stop recommendation.",
    "explanation": "The product decision is about the user's job, approved sources, useful behavior, failure behavior, review, and measurable evidence. A working API call is only one part of the feature.",
    "exercise": {
      "reference": "TARGET USER: Account owner preparing a renewal call. APPROVED SOURCES: CRM, CALL, SUPPORT, and USAGE synthetic files. SCOPE: Five synthetic variants and draft-only output. OUT OF SCOPE: CRM writes, sent messages, pricing approval, and customer-facing use. MISSING DATA: Show the missing source or field and do not fill it. FAILURE: Withhold truncated output and display the terminal state. HUMAN REVIEW: Maya Chen or Priya Shah, fictional reviewers, compares every brief with the records. ACCEPTANCE: All five variants preserve critical facts, produce zero unsupported commitments, and take no more than 12 minutes per brief for preparation plus correction. DECISION: Proceed with the offline pilot. REVIEW DATE: November 6, 2026."
    }
  },
  {
    "id": "solutions-architect-api",
    "title": "Solutions architect: Design a direct Claude API workflow",
    "category": "Technical",
    "task": "Recommend an application architecture for generating a reviewed Northstar brief through the direct Claude API.",
    "outcome": "The learner can recommend an architecture, locate a failed boundary, and choose the next diagnostic test.",
    "explanation": "The design connects each API behavior to a choice about backend location, approved context, request shape, streamed completion, failure handling, and review. API authentication and employee permission to read Northstar are separate controls. Add private connectivity or retrieval only when customer constraints require it and the chosen design supports it.",
    "exercise": {
      "reference": "RECOMMENDATION: Run the direct API call from the existing bounded backend. Call check_account_access before reading Northstar records. Select the approved CRM, CALL, SUPPORT, and USAGE versions. Send a bounded request, filter typed content blocks, require a terminal stream event, log request ID and safe counts, then route the draft to human review. MAIN TRADEOFF: The existing backend keeps the path simple, while application code must own access, source selection, and stream state. TRACE A is a network path failure. Inspect DNS, TLS, egress, and timeout budget, then test reachability from the same backend. TRACE B is API authentication or permission failure. Inspect the Authorization header, workspace access, API version, and endpoint, then send a minimal approved request. TRACE C is incorrect context. Inspect retrieval filters, selected version, and timestamps, then assert SUPPORT version 2026-10-13 before invocation. Add private connectivity or retrieval only when customer constraints require it."
    }
  },
  {
    "id": "software-engineer-api",
    "title": "Software engineer: Build and debug the Claude API path",
    "category": "Technical",
    "task": "Build the server-side path that drafts a Northstar renewal handoff from approved records.",
    "outcome": "The learner can explain and repair the request, response, stream, tool loop, and error path without a live key.",
    "explanation": "The backend checks the employee's Northstar access before reading account records. It sends approved context in a bounded Claude request.\n\nRead the response by block type. Text blocks form the draft. A tool_use block requests work from the application. Validate and authorize it, then return a result matching its tool_use.id.\n\nFor a stream, append text deltas once. Inspect the stop reason and message_stop. An error after HTTP 200 or a max_tokens stop leaves the draft incomplete. Preserve partial text and reconcile any possible action before retrying. The account owner still checks the final draft against its sources.",
    "exercise": {
      "reference": "Start with the Northstar case. The CRM says the renewal date is 2027-01-31 and Maya Chen owns it. The call notes record a 12% discount discussion. Approval is not recorded.\n\nInspect the completed handler in this order. Confirm check_account_access runs before any Northstar context is loaded. Verify the response loop extracts every content block with type text. A tool_use block is only a request. The application validates and authorizes it before execution. When the application replies, it preserves the prior assistant blocks and sends one tool_result whose tool_use_id matches the request.\n\nFor streaming, HTTP 200 only opens the stream. Completion requires message_stop. Even with stop_reason end_turn, accept the draft only when the renewal date, owner, open case, source links, and unsupported discount checks pass. The accepted result keeps 2027-01-31, Maya Chen, Case 4821, and the 12% discount marked unapproved.\n\nTreat max_tokens or any interruption as partial output. Preserve it for diagnosis and trigger no external action. Fix a 401 credential problem before retrying. Retry a 429 only within the stated attempt and delay budget.\n\nYour task is to point to each boundary in the completed code. Rejoin the main exercise at Classify errors and stop reasons."
    }
  },
  {
    "id": "applied-ai-evaluation",
    "title": "Applied AI engineer: Evaluate facts, failures, and edge cases",
    "category": "Technical",
    "task": "Evaluate the renewal brief across baseline, conflict, missing-field, and untrusted-instruction cases.",
    "outcome": "The learner can build a task-specific scorecard, explain a failure, and judge whether a change improves the right behavior.",
    "explanation": "The evaluation mirrors the real task. Code can grade stable factual fields, while a short human rubric can grade tone and usefulness. Telemetry helps diagnose behavior but does not replace output checks.",
    "exercise": {
      "reference": "A passing baseline preserves Maya as owner, case 4821, the 64 versus 78 usage comparison, unknown SSO and security ownership, and the unapproved discount. The conflicting-date case keeps both dates visible. The missing-SSO case does not invent a question or entitlement. The untrusted instruction never changes discount status."
    }
  },
  {
    "id": "engineering-manager-claude-code",
    "title": "Engineering manager: Review a Claude Code change and pilot",
    "category": "Leadership",
    "task": "Review the Northstar renewal-window fix and decide how a team should introduce Claude Code.",
    "outcome": "The learner can decide whether the change is review-ready and define evidence, permissions, ownership, and signals for a team pilot.",
    "explanation": "Claude Code can inspect, plan, edit, test, and show a diff. The team still owns scope, repository access, approvals, review, tests, support, and the decision to merge.",
    "exercise": {
      "reference": "CHANGE DECISION: Ready for human review. REQUIREMENT: Include 0 through 30 and exclude negative values and day 31. FAILING EVIDENCE: Three original tests pass, then test_includes_day_30 fails with False is not true. REFERENCE DIFF: replace return 0 <= days_remaining < window_days with return 0 <= days_remaining <= window_days and add self.assertTrue(in_renewal_window(30, 30)). PASSING EVIDENCE: Ran 4 tests, OK. SCOPE CHECK: No unrelated hunks. PILOT: Use low-risk scoped tasks in the approved renewal repository with review-required permissions. Jordan Lee, fictional engineering manager, owns the pilot. Priya Shah, fictional reviewer, approves changes. Measure total time through review, rework, escaped defects, developer feedback, and tool cost. Stop on unreviewed changes, broader diffs, or repeated boundary regressions."
    }
  },
  {
    "id": "knowledge-worker-cowork",
    "title": "Knowledge worker: Produce a reviewed account action brief",
    "category": "Business",
    "task": "Prepare the Northstar action brief and a draft customer follow-up from the CRM, call, support, and usage files.",
    "outcome": "The learner can produce and verify a source-bound work product without sending a message or changing an external system.",
    "explanation": "Project instructions set the output rules and the files provide shared evidence. A person reviews the result. Cowork may help with a bounded file task when enabled, but it does not change source, permission, or approval duties.",
    "exercise": {
      "reference": "CONFIRMED FACTS: Renewal January 31, 2027, contract value $180,000, and owner Maya Chen [CRM]. SSO was asked about [CALL]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The support issue and lower use may matter to renewal planning, with no evidence of cause or churn. UNKNOWNS: SSO entitlement, discount approval, and security owner. PROPOSED ACTIONS: Maya verifies package and pricing. RevOps leaves unresolved fields blank and routes them. Marketing rejects churn and endorsement claims. PM checks missing-source and truncated-output behavior. DRAFT CUSTOMER EMAIL: We are preparing for the renewal discussion and will confirm the open SSO and support questions before our call. SOURCE CHECK: CRM supports the date, value, and owner. CALL supports only that SSO was asked about. SUPPORT supports case 4821. USAGE supports 78 to 64. The draft is not sent."
    }
  },
  {
    "id": "security-risk",
    "title": "Security / Risk: Review a regulated workflow",
    "category": "Technical",
    "task": "Review the Northstar regulated-data variation and decide which request may enter the pilot.",
    "outcome": "The learner can separate provider and customer controls, identify missing evidence, and allow, revise, or stop a workflow without treating one control as proof of compliance.",
    "explanation": "In this direct API pattern, Anthropic operates the model service, compute, and model artifacts. The customer backend owns caller and account access, approved context, tools, queues, application data, deployment, logs, and review. API authentication grants invocation access. It does not grant an employee permission to read Northstar records or make a business decision.",
    "exercise": {
      "reference": "BASELINE DECISION: Allow in the offline pilot after caller and account checks because it contains only the approved synthetic CRM, support, and usage fields. SENSITIVE VARIANT DECISION: Stop before the API call because member_id SYN-4471 is not needed for the renewal brief and no regulated-data arrangement is evidenced. NETWORKING: Customer firewall permits the documented direct API destination. Permission remains a separate application and workspace check. SECURITY: A scoped service identity may invoke the API, while customer code authorizes the employee, account, records, and tools. COMPUTE: Anthropic runs model inference. Customer runs the backend, record filter, queue, and review workflow. STORAGE: Anthropic operates model artifacts. Customer stores application data and deployment state. Request handling follows the verified model, feature, and organization arrangement. OBSERVABILITY: Customer logs app_trace_id, request_id, workspace_id, source version, status, tokens, and latency. Correlation exists only when the backend propagates those identifiers. RELIABILITY: Timeout is 30 seconds, transient retries are capped at two, 401 and 403 are not retried, and any interrupted output stays visibly incomplete. INFRASTRUCTURE AS CODE: Version the lab policy, learner role, workspace selection, and cleanup steps. Remove synthetic data and revoke temporary access after the lab. COST: Use interactive Messages for the user-waiting path. Consider an asynchronous pattern only for an approved offline workload after reviewing current retention and feature eligibility. RELEASE CONDITION: Security and legal owners document the accepted data fields, signed agreement where required, enabled organization state, feature eligibility, region settings, and logging policy."
    }
  }
]
