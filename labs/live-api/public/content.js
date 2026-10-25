// Exact public teaching fields used by the workshop backend.
export const paths = [
  {
    "id": "account-executive",
    "title": "Account Executive: Build a trusted renewal brief",
    "category": "Business",
    "task": "Prepare a source-linked Northstar renewal brief for Maya Chen before the customer call.",
    "outcome": "The learner can trace the brief to approved sources, distinguish fact, synthesis, unknown, and unsupported claim, explain one permission boundary, and choose a safe next action.",
    "explanation": "Learners arrange six cards: request, permission check, retrieval, Claude, review, and proposed CRM update. The application controls which records are available. Claude drafts from the selected records. The Account Executive reviews the draft before using it, and no CRM write occurs in the exercise. A polished sentence is not proof.",
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
    "task": "Review a Northstar renewal brief cut off by max_tokens and decide what the team must do before it can support account planning.",
    "outcome": "The learner can distinguish generation status from business completeness, withhold an incomplete brief, and assign the right next step to the technical owner and account owner.",
    "explanation": "The engineer and sales manager see the same fault through different artifacts. The engineer sees typed content and stop_reason max_tokens. The sales manager sees a brief with missing actions, owners, and source checks. Preserve the partial output as diagnostic evidence, but do not label it complete. The technical owner shortens the requested output or adjusts the bounded token budget and runs a fresh case. The account owner checks the new brief against the records before the team uses it.",
    "exercise": {
      "reference": "RESPONSE STATUS: Incomplete because stop_reason is max_tokens. USABLE TEXT TO PRESERVE: The renewal date and Maya Chen ownership statements match CRM, but remain part of a diagnostic partial response. INCOMPLETE TEXT: 'Case 4821 is' cannot support a case-status statement. MISSING REQUIRED SECTIONS: Completed support fact, discount and SSO unknowns, proposed next actions, named owners, and source check. TECHNICAL OWNER: Shorten the requested output or increase the bounded output budget, then run a fresh case and retain its terminal state. ACCOUNT OWNER: Maya checks the fresh brief against CRM, CALL, SUPPORT, and USAGE. CONDITION BEFORE USE: A fresh response finishes with stop_reason end_turn, every required section is present, and the source check finds no unsupported commitment."
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
    "explanation": "The seven-step application path is employee request, account-access check, approved record retrieval, bounded Claude request, allowed tool loop, streamed response with source links and interruption handling, then Account Executive review and next-action recording. The response contains typed blocks and a stop reason. In a stream, stop_reason arrives in message_delta and message_stop ends the event flow. max_tokens means generation reached the requested output limit, so preserve partial text as diagnostic evidence and keep the artifact incomplete. Shorten the requested output or adjust the bounded budget before a fresh request. A stream error can arrive after HTTP 200. Application code owns authorization, tool execution, retries, and side effects.",
    "exercise": {
      "reference": "REQUEST: Use the configured model and bounded output limit. Include approved records only. RESPONSE: Iterate typed content blocks. Join text blocks, assemble complete tool input, validate it, authorize the account, execute the allowed lookup, and match tool_result to the tool_use identifier in the next request. STREAM: Append each text delta once at the matching block index, ignore ping for content, and inspect the terminal events and exceptions. A 401 needs credential correction. A bounded 429 may retry. A midstream error or max_tokens response remains incomplete and triggers no external action. See the annotated request and response and the event lab for complete JSON examples."
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
