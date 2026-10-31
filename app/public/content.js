export const paths = [
  {
    id: "account-executive",
    title: "Account Executive: Build a trusted renewal brief",
    category: "Business",
    surface: "Northstar app with the direct Claude API",
    minutes: 45,
    summary: "Use approved Northstar records to prepare for a renewal conversation without hiding unknowns or inventing commitments.",
    outcome: "The learner can trace the brief to approved sources, distinguish fact, synthesis, unknown, and unsupported claim, explain one permission boundary, and choose a safe next action.",
    task: "Prepare a source-linked Northstar renewal brief for Maya Chen before the customer call.",
    explanation: "The application checks which Northstar records the employee may read. Its server holds the Claude API credential and sends only approved records.\n\nYou review the resulting draft against those records. Separate supported facts, interpretation, unknowns, and unsupported claims. A finished response does not approve pricing or entitlement.\n\nThe engineer inspects the same integration and its failures. Your evidence is a source-checked brief and a safe next action. Claude for Work is available as an alternate exercise.",
    demo: {
      title: "From four records to one reviewed brief",
      before: "The CRM shows a January 31, 2027 renewal and a 12 percent discount that was discussed. The support file has an open alert-email case. The SSO answer and security owner are missing.",
      after: "CONFIRMED: Northstar renews January 31, 2027 and Maya Chen is the owner [CRM]. Case 4821 for delayed shipment-alert emails is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The open case and lower use may matter to the renewal, but the records do not establish cause or churn. UNKNOWNS: SSO entitlement, discount approval, and security owner. NEXT: Maya verifies pricing and asks who owns the security follow-up before customer use.",
      notice: "The source links and visible unknowns matter as much as the prose. Claude drafts the handoff, while the AE decides what is safe to use."
    },
    value: "The workflow can reduce preparation time while giving the team a consistent evidence trail for customer conversations.",
    exercise: {
      reviewDraft: "Maya Chen owns Northstar’s January 31, 2027 renewal [CRM]. A 12 percent discount is approved [CALL]. Case 4821 remains open [SUPPORT]. Weekly active users are 64, previously 78 [USAGE]. SSO entitlement and the security follow-up owner remain unknown [CALL].",
      prompt: "Review the practice draft below against the CRM, call notes, support summary, and usage summary. Label each statement as fact, synthesis, unknown, or unsupported. Remove the unsupported discount claim and write the next customer question.",
      template: "Fact and source:\nSynthesis and evidence:\nUnknown:\nUnsupported claim to remove:\nNext customer question:\nSafe next action:",
      reference: "FACT AND SOURCE: Renewal January 31, 2027 and owner Maya Chen [CRM]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The support issue and lower use may matter, with no evidence of cause or churn. UNKNOWN: SSO entitlement and security owner. UNSUPPORTED CLAIM REMOVED: The 12 percent discount is approved. NEXT CUSTOMER QUESTION: Who owns the security follow-up? SAFE NEXT ACTION: Maya confirms package and pricing details internally before using the brief.",
      checks: [
        "Every number, date, and product claim points to a supplied source",
        "The 12 percent discount is never described as approved",
        "The learner separates lower usage from any claim about cause or churn",
        "The next action names a person or question without inventing an answer"
      ]
    },
    challenge: {
      prompt: "Remove the learner's permission to read the support record. Predict the brief, then revise it without guessing the case status.",
      reference: "VISIBLE LIMITATION: Support status is unavailable because this learner cannot access the approved support record. Remove all claims about case 4821 and case 4794. Preserve the sourced CRM, CALL, and USAGE facts. NEXT QUESTION: Who can review the support record and confirm the current case status? SAFE NEXT STEP: Route the gap to an authorized support-data owner before customer use."
    },
    quiz: [
      {
        question: "Which statement is safe to include as a confirmed fact?",
        options: [
          "Northstar has an approved 12 percent discount",
          "Support case 4821 for delayed shipment-alert emails is open",
          "Lower usage proves that Northstar will churn"
        ],
        answer: 1,
        rationale: "The support export names case 4821 and says it remains open. The other claims are not supported."
      },
      {
        question: "What should the AE do when the brief has no SSO entitlement record?",
        options: [
          "Assume the Growth package includes SSO",
          "Remove the SSO question so the brief looks complete",
          "State that SSO is unknown and route the question to the right owner"
        ],
        answer: 2,
        rationale: "The missing entitlement is a visible gap. The workflow must not fill it from general knowledge."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 5, label: "Frame the renewal decision and inspect three source notes" },
        { minutes: 7, label: "Arrange request, permission, retrieval, Claude, review, and proposed CRM update cards" },
        { minutes: 8, label: "Demonstrate the stream, source links, unknown field, and review state" },
        { minutes: 10, label: "Classify each statement as sourced fact, synthesis, unknown, or unsupported" },
        { minutes: 7, label: "Remove support access and require a visible limitation" },
        { minutes: 6, label: "Teach back the value, source, permission boundary, and approver" },
        { minutes: 2, label: "Write one supported statement, one open question, and one safe next step" }
      ],
      checkpoint: "Before opening the brief, ask participants to name the four common steps: select approved records, request a source-bound draft, review it against the records, and use the reviewed output in the existing process.",
      recovery: "Give a blocked learner the completed six-card workflow and annotated brief, then ask them to explain one step before rejoining at claim classification. Give a faster learner a second copy with January 31 and February 15 renewal dates and require both sources, the unresolved conflict, and the next question."
    },
    resources: [
      { label: "Claude Projects", url: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" },
      { label: "Evaluation design", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" }
    ]
  },
  {
    id: "executive",
    title: "COO / Executive: Decide on a bounded pilot",
    category: "Leadership",
    surface: "Claude for Work with a private Project on Team or Enterprise",
    minutes: 20,
    summary: "Use the Northstar workflow to make a clear pilot decision with evidence, ownership, cost, and stop conditions.",
    outcome: "The learner can authorize, revise, defer, or stop a pilot and state the decision, required evidence, and next owner.",
    task: "Decide whether to fund a limited renewal-brief pilot for one team and close with a concrete operating plan.",
    explanation: "The COO or executive does not need to inspect API fields. The decision is whether the workflow is worth testing, what resources it needs, who owns it, what evidence matters, and what would stop it.",
    demo: {
      title: "A useful draft and a dangerous draft",
      before: "One brief keeps the discount and SSO status unknown. A second brief states that the discount is approved and treats lower usage as churn risk.",
      after: "DECISION: Proceed with an internal offline pilot. SCOPE: Five synthetic fixture variants, baseline, conflicting renewal date, missing SSO evidence, untrusted discount instruction, and truncated output. RESOURCES: Jordan Lee, fictional pilot owner, one engineer, the offline fixture set, and two fictional account reviewers, Maya Chen and Priya Shah. SPENDING LIMIT: $100 illustrative cap for the exercise, not real authorized spend. REVIEW DATE: November 6, 2026. PASS: All five variants preserve every critical fact, make zero unsupported commitments, and take no more than 12 minutes per brief for preparation plus correction. STOP: Stop on any invented commitment or skipped review. NEXT OWNER: Jordan Lee records results and returns the decision to Avery Brooks, fictional COO.",
      notice: "A convincing demo is not pilot evidence. The decision should separate expected value from results that still need measurement."
    },
    value: "A bounded decision gives the team room to learn while keeping cost, review effort, and customer risk visible.",
    exercise: {
      prompt: "Complete a pilot decision card. Name the decision, pilot scope, required people and tools, spending limit, named owner, human reviewer, success signals, review date, stop condition, evidence still needed, and next owner.",
      template: "Decision:\nPilot scope:\nRequired resources:\nSpending limit:\nNamed owner:\nReviewer:\nSuccess signals:\nReview date:\nStop condition:\nEvidence still needed:\nNext owner:",
      reference: "DECISION: Proceed with an internal offline pilot only. SCOPE: Five synthetic variants with no customer-facing use. OWNER: Jordan Lee, fictional pilot owner. REVIEWERS: Maya Chen and Priya Shah, fictional account reviewers. RESOURCES: One engineer, the offline fixture set, a review scorecard, and reviewer time. SPENDING LIMIT: $100 illustrative cap for the exercise, not real authorized spend. REVIEW DATE: November 6, 2026. QUALITY CRITERIA: Five of five variants preserve critical fields and produce zero unsupported commitments. TIME CRITERION: Preparation plus correction is 12 minutes or less per brief, with reviewer effort recorded. EVIDENCE STILL NEEDED: Record current manual preparation and correction time. Collect pilot quality, total work, and operating cost for the same variants before considering expansion. STOP CONDITION: Any invented commitment, missing source check, or skipped reviewer stops the pilot. NEXT OWNER: Jordan Lee compiles the evidence for Avery Brooks, fictional COO, who decides whether to revise, stop, or expand.",
      checks: [
        "The decision names one accountable owner and the next owner",
        "The close states resources, spending limit, and review date",
        "The scope limits records, users, and customer-facing use",
        "The success signals include quality and total work, not seat counts",
        "The stop condition covers unsupported commitments or missing review"
      ]
    },
    challenge: {
      prompt: "A revised operating cost estimate exceeds the exercise's illustrative $100 cap, and the planned engineer is unavailable. Revisit the decision and state what must change before the pilot proceeds.",
      reference: "Revise or defer the pilot. Secure an engineer and revise the plan to fit the illustrative $100 cap before proceeding. Keep the original quality and review conditions. Treat the revised estimate as a hypothetical assumption, not a measured result."
    },
    quiz: [
      {
        question: "Which result best supports expanding the pilot?",
        options: [
          "More employees opened Claude during the pilot",
          "The first demo produced fluent prose",
          "Comparable briefs have fewer unsupported claims and lower total preparation plus correction time"
        ],
        answer: 2,
        rationale: "Fewer unsupported claims and lower total work measure the task outcome. Usage and fluency do not establish value or accuracy."
      },
      {
        question: "What must be explicit before customer-facing use?",
        options: [
          "A promise that every brief will be correct",
          "The human reviewer and approval boundary",
          "A plan to hide incomplete drafts from the audit trail"
        ],
        answer: 1,
        rationale: "The workflow needs named human review and approval. It cannot promise perfect output."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 3, label: "Name the funding decision" },
        { minutes: 4, label: "Sequence the shared Northstar workflow" },
        { minutes: 5, label: "Compare the two drafts" },
        { minutes: 5, label: "Complete and defend the pilot card" },
        { minutes: 3, label: "Apply the changed cost and owner case" }
      ],
      checkpoint: "Ask the learner to identify approved records, source-bound draft, human review, and existing process before discussing budget or rollout.",
      recovery: "Provide the completed pilot card and ask the learner to explain one success signal and one stop condition. The optional case changes cost and ownership."
    },
    resources: [
      { label: "Define success criteria", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" },
      { label: "Claude for Work", url: "https://support.anthropic.com/en/collections/9387370-claude-for-work-team-enterprise-plans" }
    ]
  },
  {
    id: "sales-manager",
    title: "Sales manager: Review an incomplete renewal brief",
    category: "Leadership",
    surface: "Claude for Work account-planning review",
    minutes: 30,
    summary: "Judge an unfinished Northstar brief, identify missing actions and evidence, and coach the technical and account owners toward a reviewable result.",
    outcome: "The learner can recognize an unfinished brief, withhold unsupported claims, and route source review and next actions to Maya Chen and the right specialist.",
    task: "Review the unfinished Northstar brief, identify what is missing, and assign source checks and next actions before the team uses it for account planning.",
    explanation: "A readable fragment is not ready for account planning. Mark where it stops, then list the missing facts, decisions, owners, and next actions. Keep supported facts, but do not complete the sentence or infer why usage fell. The technical owner repairs the brief-producing workflow and returns a complete draft. Maya Chen checks each claim against the CRM, call, support, and usage records before anyone uses it.",
    demo: {
      title: "From unfinished fragment to reviewed account brief",
      before: "Northstar renewal brief\n\nRenewal date: January 31, 2027 [CRM]. Account owner: Maya Chen [CRM]. Weekly active users: 64, down from 78 [USAGE]. Case 4821 is",
      after: "Northstar renews January 31, 2027. Maya Chen owns the account [CRM]. Case 4821 about delayed shipment-alert emails remains open [SUPPORT]. Weekly active users are 64, down from 78 [USAGE]. The records do not establish why usage changed. The 12% discount and SSO entitlement remain unknown because no approval or entitlement record is present. The technical owner returns the complete draft. The support owner confirms the next step for Case 4821. Maya checks CRM, CALL, SUPPORT, and USAGE, then asks the pricing owner for discount evidence and the solutions owner for the SSO record before account planning.",
      notice: "A complete brief can still contain unsupported claims. Business use requires both a complete brief and Maya's source review.",
    },
    value: "The team avoids coaching from a polished fragment and gives each owner a specific next step tied to technical and business evidence.",
    exercise: {
      prompt: "Review the partial Northstar brief. Keep supported facts, mark missing content, assign the repair to the technical owner, and show what Maya must verify before account planning.",
      template: "Brief status:\nSupported text to keep:\nUnfinished text:\nMissing facts and actions:\nSource review:\nTechnical owner and next step:\nBusiness owners and next steps:\nCondition before use:",
      reference: "The brief is unfinished. Keep the January 31, 2027 renewal date, Maya Chen as account owner, and the usage numbers because their cited records support them. Do not complete the sentence Case 4821 is or infer why usage fell.\n\nWithhold the brief from account planning. The missing items are the full support status, the 12% discount decision, SSO entitlement, owners, next actions, and Maya's source review.\n\nAssign the repair to the technical owner, who returns a complete draft. The support owner confirms that Case 4821 remains open and records the next support step.\n\nMaya checks the renewal date, Case 4821, and the change from 78 to 64 weekly active users against CRM, SUPPORT, and USAGE. She keeps the cause unknown. She asks the pricing owner for discount approval evidence and the solutions owner for the SSO record. Until those arrive, both fields stay unknown.\n\nThe brief may enter account planning only after every required section has an owner and supported claims pass Maya's review. Rejoin at Business value and practice.",
      checks: [
        "The review labels the fragment unfinished even when some facts are readable",
        "The learner names missing actions, owners, and source checks",
        "The technical owner receives a clear repair and complete-draft handoff",
        "Maya reviews the completed brief before business use",
      ],
    },
    challenge: {
      prompt: "A complete brief includes every required section, but says the 12% discount is approved. Decide whether the sales manager may use it and route the next step.",
      reference: "Do not use the brief as written. Completion does not establish approval. The call notes say the discount was discussed and contain no approval. Mark approval unknown, ask Maya to obtain the pricing owner's approval record, and revise the brief only when that evidence exists.",
    },
    quiz: [
      {
        question: "What makes the first Northstar brief incomplete?",
        options: [
          "It includes supported CRM facts",
          "It ends mid-sentence and omits required actions, owners, and review",
          "It keeps the discount unknown",
        ],
        answer: 1,
        rationale: "Readable facts do not make the fragment complete. The brief stops before the support status, owners, actions, and source review.",
      },
      {
        question: "Which handoff gives both owners a concrete next step?",
        options: [
          "Ask Maya to repair the workflow and the technical owner to approve pricing",
          "Use the fragment now and correct it after the customer call",
          "Have the technical owner return a complete draft and Maya verify its fields and sources",
        ],
        answer: 2,
        rationale: "The technical owner repairs the workflow. Maya decides whether the completed brief matches the approved records and routes missing evidence.",
      },
      {
        question: "A complete brief says the 12% discount is approved, but the records show discussion only. What should happen?",
        options: [
          "Mark approval unknown and request the pricing approval record",
          "Use the claim because every section is present",
          "Treat the call discussion as approval",
        ],
        answer: 0,
        rationale: "A complete brief still needs approval evidence. Until the record exists, discount approval remains unknown.",
      },
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Frame the account-planning decision and required brief sections" },
        { minutes: 5, label: "Compare the unfinished fragment with the completed brief" },
        { minutes: 6, label: "Separate supported facts from unsupported claims" },
        { minutes: 8, label: "Assign missing actions, evidence, and owner handoffs" },
        { minutes: 5, label: "Review the complete brief with the unsupported discount" },
        { minutes: 2, label: "Rejoin at Business value and practice" },
      ],
      checkpoint: "Ask the learner to name what is unfinished, what is unsupported, who repairs the workflow, and what Maya must review. Continue when each item has an owner and evidence requirement.",
      recovery: "Give a blocked learner the annotated fragment and ask them to name one missing field and its owner. Give a faster learner the complete brief with the unsupported discount.",
    },
    resources: [
      { label: "Stop reasons and fallback", url: "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons" },
      { label: "Streaming messages", url: "https://platform.claude.com/docs/en/build-with-claude/streaming" },
      { label: "Claude API errors", url: "https://platform.claude.com/docs/en/api/errors" },
    ],
  },
  {
    id: "revenue-operations",
    title: "Revenue Operations: Route facts, blanks, and exceptions",
    category: "Business",
    surface: "Claude for Work with a private Project",
    minutes: 30,
    summary: "Map the Northstar handoff into CRM fields and exception routes without turning missing information into a value.",
    outcome: "The learner can draft safe field updates, preserve unknowns, and route each exception to an owner.",
    task: "Prepare proposed CRM updates and exception routes for the Northstar renewal handoff.",
    explanation: "Claude can draft a field map from approved sources. Revenue Operations decides which fields may be proposed, which must remain blank, and where unresolved items go next.",
    demo: {
      title: "A controlled CRM handoff",
      before: "The next-step field is blank, SSO entitlement is absent, the discount has no approval, and the security follow-up has no owner.",
      after: "PROPOSED FIELD MAP: renewal_date = 2027-01-31 [CRM], account_owner = Maya Chen [CRM], support_case = 4821 open [SUPPORT], weekly_active_users = 64 with prior value 78 [USAGE]. KEEP BLANK: next_step, sso_entitlement, discount_approval, security_owner. EXCEPTION ROUTES: Commercial approver verifies the discount. Product specialist answers SSO. Maya assigns the next action and the security follow-up. REVIEWER: Maya Chen. WRITE STATUS: Proposed only, no CRM update performed.",
      notice: "A blank can be the correct result. The workflow becomes unsafe when a draft turns an unresolved field into a confirmed value."
    },
    value: "The team can reduce manual handoff work while keeping exceptions and audit history visible.",
    exercise: {
      prompt: "Map each Northstar fact to a proposed CRM field. Mark each unsupported field as blank, conflict, or needs owner. Add an exception route and review owner. Do not perform a CRM write.",
      template: "Field:\nProposed value:\nSource:\nStatus: supported, blank, conflict, or needs owner\nException route:\nReviewer:",
      reference: "FIELD renewal_date, VALUE 2027-01-31, SOURCE CRM, STATUS supported. FIELD account_owner, VALUE Maya Chen, SOURCE CRM, STATUS supported. FIELD support_case, VALUE 4821 open, SOURCE SUPPORT, STATUS supported. FIELD weekly_active_users, VALUE 64 with prior value 78, SOURCE USAGE, STATUS supported. FIELD next_step, VALUE blank, SOURCE CRM, STATUS needs owner, ROUTE Maya Chen assigns the next action. FIELD sso_entitlement, VALUE blank, STATUS needs owner, ROUTE product specialist. FIELD discount_approval, VALUE blank, STATUS needs owner, ROUTE commercial approver. FIELD security_owner, VALUE blank, STATUS needs owner, ROUTE Maya Chen. REVIEWER Maya Chen. No CRM write is part of the exercise.",
      checks: [
        "Every populated field has a source",
        "Blank and conflicting fields stay visible",
        "No discount is recorded as approved",
        "The exercise ends with a proposal and review, not an external write"
      ]
    },
    challenge: {
      prompt: "Remove support-summary.md from the approved records. Update the field map and route the resulting gap.",
      reference: "Mark support status as unavailable because the learner lacks the source. Do not reconstruct case 4821 or case 4794 from memory. Route the gap to an authorized support-data owner."
    },
    quiz: [
      {
        question: "How should the discount field be handled?",
        options: [
          "Record 12 percent as approved because it was discussed",
          "Leave approval unresolved and route it to the commercial approver",
          "Delete every mention of the discount"
        ],
        answer: 1,
        rationale: "The discussion is sourced, but approval is not. The field remains unresolved."
      },
      {
        question: "What should happen when support data is not available to the learner?",
        options: [
          "Infer the support status from usage",
          "Use a prior answer without checking its source",
          "Show the access gap and route it"
        ],
        answer: 2,
        rationale: "The workflow must surface the missing source rather than reconstruct it."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Frame the CRM handoff" },
        { minutes: 5, label: "Order records, draft, review, and existing process" },
        { minutes: 6, label: "Demonstrate the field and exception map" },
        { minutes: 8, label: "Complete the mapping exercise" },
        { minutes: 5, label: "Apply the missing-support case" },
        { minutes: 2, label: "Teach back the safest routing rule" }
      ],
      checkpoint: "Before mapping fields, ask participants to explain which step selects approved records and which step reviews the draft before CRM use.",
      recovery: "Give a blocked learner the completed field map and ask them to explain one blank. Give a faster learner the missing-support case."
    },
    resources: [
      { label: "Claude Projects", url: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" },
      { label: "Connectors", url: "https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities" }
    ]
  },
  {
    id: "marketing",
    title: "Marketing: Keep every claim tied to evidence",
    category: "Business",
    surface: "Claude for Work with a private Project",
    minutes: 25,
    summary: "Draft from approved Northstar evidence while respecting source limits and the instruction against public use of customer words or the customer name.",
    outcome: "The learner can accept, revise, or reject a claim and explain the source and approval needed for public use.",
    task: "Prepare an internal messaging draft and a claim-to-source worksheet from the Northstar records.",
    explanation: "Claude can help organize and draft. Marketing still checks whether each claim is supported, whether customer words may be used, and whether an approval path exists.",
    demo: {
      title: "Supported language versus polished invention",
      before: "A draft says that Northstar is at churn risk, received a discount, and praised the product. None of those claims is supported.",
      after: "INTERNAL DRAFT: Weekly active users changed from 78 to 64 [USAGE], and case 4821 remains open [SUPPORT]. These items may warrant follow-up, but the records do not establish churn or cause. CLAIM WORKSHEET: Usage change, accept for internal use. Open case, accept for internal use. Churn risk, reject. Approved discount, reject. Customer endorsement, reject. PUBLIC USE: Exclude the Northstar name and all customer words until a separate approval exists.",
      notice: "Citations help find evidence. They do not prove that a claim or interpretation is appropriate for publication."
    },
    value: "The workflow speeds up early drafting while reducing unsupported product, customer, and outcome claims.",
    exercise: {
      prompt: "Build a claim-to-source worksheet. Accept supported facts, label synthesis, reject unsupported claims, and state whether each item is allowed in internal or public material.",
      template: "Proposed claim:\nSource:\nFact or synthesis:\nInternal or public:\nApproval needed:\nDecision: accept, revise, or reject",
      reference: "ROW 1: Weekly active users changed from 78 to 64. SOURCE: USAGE. TYPE: fact. USE: internal. DECISION: accept. ROW 2: Case 4821 remains open. SOURCE: SUPPORT. TYPE: fact. USE: internal. DECISION: accept. ROW 3: Northstar is at churn risk. SOURCE: none. DECISION: reject. ROW 4: The 12 percent discount is approved. SOURCE: none. DECISION: reject. ROW 5: Northstar praised the product. SOURCE: none and no public-use approval. DECISION: reject. Public copy omits the customer name and customer words.",
      checks: [
        "Each accepted claim has a supplied source",
        "The learner does not convert usage data into a causal claim",
        "Customer name and words remain out of public material",
        "Unsupported claims are removed or rewritten as questions"
      ]
    },
    challenge: {
      prompt: "Remove the usage report. Revise the internal draft and explain which statements and review steps must change.",
      reference: "Remove the 64 versus 78 statement and any interpretation based on it. Keep the support facts and open questions that still have sources."
    },
    quiz: [
      {
        question: "Which statement is supported by the supplied records?",
        options: [
          "The open support case caused the usage change",
          "Northstar approved a public customer story",
          "Weekly active users changed from 78 to 64"
        ],
        answer: 2,
        rationale: "The usage report provides the two values but does not establish cause or publication approval."
      },
      {
        question: "What is the safest response to a fluent but unsupported customer quote?",
        options: [
          "Keep it because Claude wrote it confidently",
          "Remove it and identify the evidence or approval that would be required",
          "Publish it without the customer name"
        ],
        answer: 1,
        rationale: "Fluency does not provide evidence or permission to use customer words."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 3, label: "Frame the evidence-backed drafting task" },
        { minutes: 5, label: "Sequence source selection, draft, review, and use" },
        { minutes: 6, label: "Demonstrate the claim worksheet" },
        { minutes: 7, label: "Review and revise the draft" },
        { minutes: 4, label: "Apply the removed-source challenge" }
      ],
      checkpoint: "Ask participants to name where evidence enters the flow and where public-use approval remains outside the draft.",
      recovery: "Give a blocked learner the accepted and rejected example rows. Ask them to explain one rejection before rejoining. The optional case removes the usage source."
    },
    resources: [
      { label: "Google Workspace connector citations", url: "https://support.claude.com/en/articles/10166901-use-google-workspace-connectors" },
      { label: "Evaluation design", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" }
    ]
  },
  {
    id: "product-manager",
    title: "Product manager: Define useful and testable behavior",
    category: "Leadership",
    surface: "Claude for Work and direct Claude API boundary",
    minutes: 30,
    summary: "Specify the Northstar feature, its missing-data behavior, and the evidence needed for a pilot decision.",
    outcome: "The learner can write a bounded requirement, acceptance checks, and a proceed, revise, or stop recommendation.",
    task: "Define a pilot for an evidence-backed renewal brief inside the account workflow.",
    explanation: "The product decision is about the user's job, approved sources, useful behavior, failure behavior, review, and measurable evidence. A working API call is only one part of the feature.",
    demo: {
      title: "Two briefs, two product behaviors",
      before: "One brief preserves missing SSO and discount approval. The other fills both gaps and implies that lower usage means churn risk.",
      after: "PILOT BRIEF: Target user is an account owner preparing a renewal call. Job is to create a reviewed brief from CRM, CALL, SUPPORT, and USAGE files. In scope are five synthetic cases and draft-only output. Out of scope are CRM writes, sent messages, pricing approval, and customer-facing use. Missing data stays visible. A failed or truncated request is withheld. Each brief is checked by Maya Chen or Priya Shah, fictional reviewers. PASS requires zero unsupported commitments, every critical field correct, and preparation plus correction at or below 12 minutes per brief. Record latency and cost for the same five variants before deciding whether to expand. DECISION: Proceed with the offline pilot and review results on November 6, 2026.",
      notice: "Useful behavior includes refusing to complete the story when evidence is absent."
    },
    value: "A clear requirement helps engineering and design build the right behavior and gives the pilot a defensible decision point.",
    exercise: {
      prompt: "Write the target user, initial scope, approved sources, visible unknown behavior, human review, failure behavior, and acceptance checks. Recommend proceed, revise, or stop.",
      template: "Target user:\nJob to be done:\nApproved sources:\nIn scope:\nOut of scope:\nMissing-data behavior:\nFailure behavior:\nHuman review:\nAcceptance checks:\nDecision:",
      reference: "TARGET USER: Account owner preparing a renewal call. APPROVED SOURCES: CRM, CALL, SUPPORT, and USAGE synthetic files. SCOPE: Five synthetic variants and draft-only output. OUT OF SCOPE: CRM writes, sent messages, pricing approval, and customer-facing use. MISSING DATA: Show the missing source or field and do not fill it. FAILURE: Withhold truncated output and display the terminal state. HUMAN REVIEW: Maya Chen or Priya Shah, fictional reviewers, compares every brief with the records. ACCEPTANCE: All five variants preserve critical facts, produce zero unsupported commitments, and take no more than 12 minutes per brief for preparation plus correction. Record latency and cost for the same five variants before deciding whether to expand. DECISION: Proceed with the offline pilot. REVIEW DATE: November 6, 2026.",
      checks: [
        "The requirement names the user and decision",
        "Missing support data produces a visible gap",
        "A failed or truncated response is not presented as complete",
        "The pilot decision uses task evidence rather than usage alone"
      ]
    },
    challenge: {
      prompt: "Support access is removed and the usage report now conflicts with an older snapshot. Add one edge-case check and decide whether the feature still passes.",
      reference: "The feature must show the missing support source, preserve the usage conflict, and block claims that depend on either unresolved item. Revise the pilot if the current behavior hides either condition."
    },
    quiz: [
      {
        question: "Which acceptance check is most useful?",
        options: [
          "The brief sounds professional",
          "When support access is missing, the brief names the gap and does not invent case status",
          "The feature produces an answer every time"
        ],
        answer: 1,
        rationale: "Naming the access gap without inventing case status is observable and tests a real failure boundary."
      },
      {
        question: "What evidence supports a proceed decision?",
        options: [
          "A stakeholder likes the first draft",
          "The API returns HTTP 200",
          "Comparable cases meet quality checks with acceptable total work, latency, and cost"
        ],
        answer: 2,
        rationale: "The feature decision needs task quality and operating evidence across comparable cases."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Name the user problem and decision" },
        { minutes: 5, label: "Order the common workflow" },
        { minutes: 6, label: "Compare the two product behaviors" },
        { minutes: 8, label: "Write the pilot requirement" },
        { minutes: 5, label: "Apply the access and conflict case" },
        { minutes: 2, label: "Defend proceed, revise, or stop" }
      ],
      checkpoint: "Ask the learner to identify where sources are selected, where the draft is reviewed, and what action remains outside Claude.",
      recovery: "Provide the completed requirement and ask the learner to explain the missing-support check. Faster learners work the combined access and conflict case."
    },
    resources: [
      { label: "Messages API", url: "https://platform.claude.com/docs/en/api/messages/create" },
      { label: "Evaluation design", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" }
    ]
  },
  {
    id: "solutions-architect-api",
    title: "Solutions architect: Design a direct Claude API workflow",
    category: "Technical",
    surface: "Claude Platform API",
    minutes: 45,
    summary: "Design and defend the Northstar renewal workflow across application identity, account access, approved context, the direct Claude API, streaming, logging, and review boundaries.",
    outcome: "The learner can recommend an architecture, locate a failed boundary, and choose the next diagnostic test.",
    task: "Recommend an application architecture for generating a reviewed Northstar brief through the direct Claude API.",
    explanation: "The design connects each API behavior to a choice about backend location, approved context, request shape, streamed completion, failure handling, and review. API authentication and employee permission to read Northstar are separate controls. Add private connectivity or retrieval only when customer constraints require it and the chosen design supports it.",
    demo: {
      title: "Trace the architecture and one failure",
      before: "FLAWED FLOW: employee -> backend attaches Northstar facts -> account access check -> POST /v1/messages -> final brief. TRACE A: TIMEOUT before any request ID. TRACE B: HTTP 401 with request ID req_offline_401. TRACE C: HTTP 200 with request ID req_offline_context, but SUPPORT version 2026-10-01 was selected instead of approved version 2026-10-13.",
      after: "ANNOTATED FLOW: employee -> [1 application account access] -> [2 approved CRM, CALL, SUPPORT, and USAGE selection] -> [3 bounded backend] -> [4 POST /v1/messages] -> [5 typed blocks and terminal stream] -> [6 source check] -> [7 human review] -> existing process. TRACE A first inspection: DNS, TLS, egress, and timeout budget. Test a known reachable endpoint from the same backend. TRACE B first inspection: credential presence and validity, then the expected authentication header, API version, and endpoint. Test a minimal approved request. TRACE C first inspection: retrieval filter, selected version, and source timestamp. Assert that SUPPORT version 2026-10-13 is attached before invocation.",
      notice: "Network failure, API authentication failure, and incorrect source context can look similar to a user but require different first inspections."
    },
    value: "The design places Claude inside the customer's application workflow while keeping access, failure, and review ownership explicit.",
    exercise: {
      prompt: "Annotate the Northstar flow from employee request through reviewed output. Decide where the backend runs, how it receives approved context, and whether customer constraints require a private network or retrieval component. Connect authentication, typed content, streaming, stop reasons, tools, and errors to design choices. Diagnose the supplied network, API authentication, and incorrect-context traces.",
      template: "Backend location:\nCaller identity:\nAccount authorization:\nApproved context:\nNetwork requirement:\nDirect API authentication:\nRequest and stream contract:\nLogs and request ID:\nReview boundary:\nMain tradeoff:\nFailed layer:\nFirst inspection:\nTest that exposes a bad assumption:",
      reference: "RECOMMENDATION: Run the direct API call from the existing bounded backend. Call check_account_access before reading Northstar records. Select the approved CRM, CALL, SUPPORT, and USAGE versions. Send a bounded request, filter typed content blocks, require a terminal stream event, log request ID and safe counts, then route the draft to human review. MAIN TRADEOFF: The existing backend keeps the path simple, while application code must own access, source selection, and stream state. TRACE A is a network path failure. Inspect DNS, TLS, egress, and timeout budget, then test reachability from the same backend. TRACE B is an API authentication failure (401). Inspect credential presence and validity and the expected authentication header first, then verify the API version and endpoint before a minimal approved request. A 403 is a permission error. TRACE C is incorrect context. Inspect retrieval filters, selected version, and timestamps, then assert SUPPORT version 2026-10-13 before invocation. Add private connectivity or retrieval only when customer constraints require it.",
      checks: [
        "The design separates employee account access from direct API authentication",
        "Each API behavior is connected to a design choice",
        "Backend, approved context, and any network or retrieval component follow customer constraints",
        "The stream stays incomplete until its terminal event",
        "The recommendation names a main tradeoff, a bad-assumption test, and the first inspection after failure"
      ]
    },
    challenge: {
      prompt: "A trace shows successful invocation but an old support record and a complete response. Identify the control and owner, then choose a test that distinguishes stale retrieval from model behavior.",
      reference: "Inspect source version, retrieval filters, timestamps, and selected chunks before changing the prompt or model. The data or retrieval owner fixes freshness. A successful model call does not prove current source selection."
    },
    quiz: [
      {
        question: "The direct API returns a 401 or 403. What should be checked first?",
        options: [
          "The customer's discount approval",
          "The wording of the renewal email",
          "The API credential, workspace access, request headers, and endpoint"
        ],
        answer: 2,
        rationale: "An API authentication or permission failure points to the API access path, not business content."
      },
      {
        question: "A response uses an old support record. Which action is most useful?",
        options: [
          "Increase max_tokens",
          "Inspect retrieval inputs, filters, source versions, and timestamps",
          "Retry the same request until the answer changes"
        ],
        answer: 1,
        rationale: "The evidence points to source selection or freshness. More tokens and blind retries do not address it."
      },
      {
        question: "What proves that an employee may read Northstar data?",
        options: [
          "The application account-authorization check",
          "Successful Claude API authentication",
          "A complete stream"
        ],
        answer: 0,
        rationale: "Claude API access and stream completion do not grant permission to read a customer account."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 5, label: "Frame the architecture decision" },
        { minutes: 8, label: "Sequence the common account workflow" },
        { minutes: 10, label: "Annotate identity, context, API, and review boundaries" },
        { minutes: 10, label: "Diagnose a prepared failure trace" },
        { minutes: 8, label: "Work the stale-source challenge" },
        { minutes: 4, label: "Defend the recommendation and next test" }
      ],
      checkpoint: "Before opening the architecture, ask learners to name selected records, source-bound request, reviewed draft, and the existing process that receives it.",
      recovery: "Give a blocked learner the annotated flow and known-good direct API request checklist, then ask them to identify one boundary. Faster learners diagnose the stale-data trace."
    },
    resources: [
      { label: "Claude API overview", url: "https://platform.claude.com/docs/en/api/overview" },
      { label: "Messages API", url: "https://platform.claude.com/docs/en/api/messages/create" },
      { label: "Streaming messages", url: "https://platform.claude.com/docs/en/build-with-claude/streaming" },
      { label: "Authentication", url: "https://platform.claude.com/docs/en/manage-claude/authentication" }
    ]
  },
  {
    id: "software-engineer-api",
    title: "Software engineer: Build and debug the Claude API path",
    category: "Technical",
    surface: "Claude Platform Messages API",
    minutes: 45,
    summary: "Inspect a source-bound request, stream text safely, enforce a read-only tool boundary, and diagnose stopped or failed requests.",
    outcome: "The learner can explain and repair the request, response, stream, tool loop, and error path without a live key.",
    task: "Build the server-side path that drafts a Northstar renewal handoff from approved records.",
    explanation: "The backend checks the employee's Northstar access before reading account records. It sends approved context in a bounded Claude request.\n\nRead the response by block type. Text blocks form the draft. A tool_use block requests work from the application. Validate and authorize it, then return a result matching its tool_use.id.\n\nFor a stream, append text deltas once. Inspect the stop reason and message_stop. An error after HTTP 200 or a max_tokens stop leaves the draft incomplete. Preserve partial text and reconcile any possible action before retrying. The account owner still checks the final draft against its sources.",
    demo: {
      title: "From typed request to reviewed draft",
      before: "The unsafe handler reads only the first content block and executes a proposed tool without checking caller or account scope. A second response returns HTTP 200 and partial text, Case 4821 is, with stop_reason max_tokens. Neither response is a reviewed business artifact.",
      after: "Append text deltas once. Ignore ping events for text assembly. Match each delta to its content-block index. Authorize the caller and account before a proposed lookup can run. Preserve a max_tokens draft as incomplete, shorten the requested output or adjust the bounded budget, and test a fresh case. Inspect final stream events and exceptions. Even end_turn still needs required-field and source checks.",
      notice: "Claude API authentication does not prove permission to read Northstar records. A stream can fail after text begins and after HTTP 200."
    },
    value: "The team gets repeatable application behavior with explicit evidence, permissions, and failure handling.",
    exercise: {
      prompt: "Inspect the saved Northstar request and illustrative response. Repair the mocked streaming handler, trace one tool_use to tool_result, then classify a 401, 429, midstream error, and max_tokens stop. No network or key is required.",
      template: "Request fields:\nTyped content handling:\nDelta accumulator:\nTerminal stop:\nTool validation:\nAccount authorization:\nError class:\nRetry, reconcile, or fail:\nSafe user-visible state:",
      reference: "Start with the Northstar case. The CRM says the renewal date is 2027-01-31 and Maya Chen owns it. The call notes record a 12% discount discussion. Approval is not recorded.\n\nInspect the completed handler in this order. Confirm check_account_access runs before any Northstar context is loaded. Verify the response loop extracts every content block with type text. A tool_use block is only a request. The application validates and authorizes it before execution. When the application replies, it preserves the prior assistant blocks and sends one tool_result whose tool_use_id matches the request.\n\nFor streaming, HTTP 200 only opens the stream. Completion requires message_stop. Even with stop_reason end_turn, accept the draft only when the renewal date, owner, open case, source links, and unsupported discount checks pass. The accepted result keeps 2027-01-31, Maya Chen, Case 4821, and the 12% discount approval marked unknown.\n\nTreat max_tokens or any interruption as partial output. Preserve it for diagnosis and trigger no external action. Fix a 401 credential problem before retrying. Retry a 429 only within the stated attempt and delay budget.\n\nYour task is to point to each boundary in the completed code. Rejoin the main exercise at Classify errors and stop reasons.",
      checks: [
        "The handler appends each text delta once",
        "The learner identifies max_tokens and midstream failure as incomplete output",
        "The tool loop matches tool_result to tool_use_id",
        "The application checks account authorization before executing the lookup"
      ]
    },
    challenge: {
      prompt: "A fresh trace contains text, ping, an unknown event, max_tokens, and conflicting renewal dates. Reconstruct the visible output and decide what the interface may display.",
      reference: "Append only text deltas, tolerate ping and unknown events safely, record max_tokens as the terminal state, keep both renewal dates as a conflict, and label or withhold the brief as incomplete. Do not trigger an external action."
    },
    quiz: [
      {
        question: "What should happen after stop_reason is max_tokens?",
        options: [
          "Present the draft as complete because text was returned",
          "Treat the output as incomplete and apply the designed continuation or failure path",
          "Retry every downstream action automatically"
        ],
        answer: 1,
        rationale: "max_tokens can truncate the result. The interface must not present it as complete."
      },
      {
        question: "Who executes a client tool and enforces account scope?",
        options: [
          "The model without validation",
          "The browser user interface alone",
          "Application code"
        ],
        answer: 2,
        rationale: "The model proposes the call. Application code validates and executes it."
      },
      {
        question: "Which failure should not be retried blindly?",
        options: [
          "A 401 or 403 authentication or permission failure",
          "A temporary overloaded response within a retry budget",
          "A connection failure before any side effect"
        ],
        answer: 0,
        rationale: "Authentication and permission failures require correction. Repeating the same request does not fix them."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Inspect the synthetic notes and name forbidden inventions" },
        { minutes: 6, label: "Sequence records, request, review, and existing process" },
        { minutes: 6, label: "Trace the typed request and illustrative response" },
        { minutes: 7, label: "Repair the mocked stream handler" },
        { minutes: 8, label: "Trace the read-only tool loop" },
        { minutes: 6, label: "Classify errors and stop reasons" },
        { minutes: 5, label: "Work the combined trace challenge" },
        { minutes: 3, label: "Teach back one boundary and one fix" }
      ],
      checkpoint: "Ask learners to locate the application account-access check before they inspect API authentication or the stream.",
      recovery: "Open the annotated request, illustrative response, saved text_stream cell, and completed tool trace. Ask the learner to explain one step before rejoining. Faster learners work the fresh combined trace."
    },
    resources: [
      { label: "Messages API", url: "https://platform.claude.com/docs/en/api/messages/create" },
      { label: "Streaming messages", url: "https://platform.claude.com/docs/en/build-with-claude/streaming" },
      { label: "Handle tool calls", url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls" },
      { label: "API errors", url: "https://platform.claude.com/docs/en/api/errors" }
    ]
  },
  {
    id: "applied-ai-evaluation",
    title: "Applied AI engineer: Evaluate facts, failures, and edge cases",
    category: "Technical",
    surface: "Claude Platform evaluation workflow",
    minutes: 40,
    summary: "Check the Northstar evaluator with copied positive controls and one negative control, then propose a targeted change only when a control behaves incorrectly.",
    outcome: "The learner can build a task-specific scorecard, explain a failure, and judge whether a change improves the right behavior.",
    task: "Check the renewal-brief evaluator across baseline, conflict, missing-field, and untrusted-instruction positive controls, plus one unsupported-approval negative control.",
    explanation: "The evaluation mirrors the real task. Code can grade stable factual fields, while a short human rubric can grade tone and usefulness. Telemetry helps diagnose behavior but does not replace output checks.",
    demo: {
      title: "One baseline and three difficult cases",
      before: "A scorecard says PASS without distinguishing copied expected values from generated answers or checking whether it rejects an unsupported approval.",
      after: "EVALUATOR CONTROLS: Baseline PASS, conflicting-date PASS, missing-SSO PASS, and untrusted-instruction PASS are the expected results for four positive controls copied from fixture expectations. They are not model outputs and do not measure model quality. discount_approved:false means no approved-discount assertion, while business approval remains unknown. NEGATIVE CONTROL: Change discount_approved to true in a copy of the baseline expectation. The evaluator must reject that unsupported approval. Model stop reason, latency, tokens, tool count, and model error class are not measured by these offline controls. Tone is not assessed by copied structured values.",
      notice: "A single aggregate score can hide a severe commitment error. Keep critical checks visible."
    },
    value: "The team can find regressions and unsafe behavior before the workflow reaches customer-facing use.",
    exercise: {
      prompt: "Check the evaluator using the four positive controls copied from fixture expectations and the deliberate unsupported-approval negative control. Explain why the negative control must be rejected. Mark model stop reason, latency, input and output tokens, tool count, and model error class as not measured. Mark tone as not assessed by these structured values. If a control behaves incorrectly, name the failing check and propose one targeted change. If every control behaves as intended, state that no corrective change is required.",
      template: "Case:\nCritical factual checks:\nUnknowns preserved:\nUnsupported commitment:\nFact and synthesis boundary:\nTone: Not assessed by copied structured values\nStop reason: Not measured\nLatency and tokens: Not measured\nTool count: Not measured\nError class: Model error class not measured\nDecision:\nTargeted change: None required if all controls behave as intended",
      reference: "EXPECTED POSITIVE CONTROLS: Baseline PASS, conflicting-date PASS with both dates retained, missing-SSO PASS with not_in_source, and untrusted-instruction PASS with discount_approved:false. These values are copied fixture expectations, not generated answers or evidence of model quality. BUSINESS STATUS: false means no approved-discount assertion, with business approval still unknown. NEGATIVE CONTROL: The copied baseline with discount_approved:true must fail the discount check. If it is wrongly accepted, correct the evaluator's unsupported-approval check and repeat the controls. If all controls behave as intended, no corrective change is required. TELEMETRY: Model stop reason, latency, tokens, tool count, and model error class are not measured. TONE: Not assessed by the copied structured values.",
      checks: [
        "Critical commitment errors remain visible outside an aggregate score",
        "The scorecard preserves source pointers and unknowns",
        "The learner does not treat copied controls as measured model quality or telemetry",
        "A targeted change is proposed only when a control behaves incorrectly"
      ]
    },
    challenge: {
      prompt: "Add a fifth case with conflicting renewal dates and a max_tokens stop. Decide whether the artifact may be released and identify the next safe action.",
      reference: "Fail the case for incomplete output, preserve both dates as unresolved, withhold the brief from the business process, and rerun only after applying the designed truncation and conflict handling."
    },
    quiz: [
      {
        question: "Which failure should be a critical check?",
        options: [
          "The brief uses a different sentence order",
          "The output has one extra neutral adjective",
          "The brief says the 12 percent discount is approved"
        ],
        answer: 2,
        rationale: "Inventing a commercial commitment is a severe task failure that should not be hidden by an average score."
      },
      {
        question: "What should the conflicting-date case require?",
        options: [
          "Choose the newest-looking date without explanation",
          "Preserve both dates, cite both sources, and request resolution",
          "Remove all dates from the brief"
        ],
        answer: 1,
        rationale: "The case tests whether the workflow preserves and routes a source conflict."
      },
      {
        question: "What does lower latency prove?",
        options: [
          "Only that the observed request completed faster under those conditions",
          "That the output is more accurate",
          "That customer review is no longer needed"
        ],
        answer: 0,
        rationale: "Latency is an operating measure. It does not establish task quality or remove review."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 5, label: "Define the real task and critical failures" },
        { minutes: 7, label: "Map the common workflow to evaluation points" },
        { minutes: 10, label: "Score the four fixtures" },
        { minutes: 8, label: "Compare quality and telemetry" },
        { minutes: 6, label: "Work the combined failure case" },
        { minutes: 4, label: "Defend the release decision" }
      ],
      checkpoint: "Ask learners to identify the reviewed artifact and the real business action that the evaluation protects.",
      recovery: "Provide the scored baseline and edge-case rubric. Ask the learner to explain one critical check before rejoining. Faster learners add the combined conflict and truncation case."
    },
    resources: [
      { label: "Evaluation design", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" },
      { label: "Stop reasons", url: "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons" },
      { label: "Rate limits", url: "https://platform.claude.com/docs/en/api/rate-limits" }
    ]
  },
  {
    id: "engineering-manager-claude-code",
    title: "Engineering manager: Review a Claude Code change and pilot",
    category: "Leadership",
    surface: "Claude Code",
    minutes: 30,
    summary: "Judge a narrow repository change, its test evidence, and the team practices needed for a small Claude Code pilot.",
    outcome: "The learner can decide whether the change is review-ready and define evidence, permissions, ownership, and signals for a team pilot.",
    task: "Review the Northstar renewal-window fix and decide how a team should introduce Claude Code.",
    explanation: "Claude Code can inspect, plan, edit, test, and show a diff. The team still owns scope, repository access, approvals, review, tests, support, and the decision to merge.",
    demo: {
      title: "A missing boundary test becomes review evidence",
      before: "REQUIREMENT: Include days 0 through 30. STARTER: return 0 <= days_remaining < window_days. TRANSCRIPT: python -m unittest -q -> Ran 3 tests, OK. Add assertTrue(in_renewal_window(30, 30)). TRANSCRIPT: FAIL test_includes_day_30, False is not true.",
      after: "REFERENCE DIFF:\n- return 0 <= days_remaining < window_days\n+ return 0 <= days_remaining <= window_days\nTEST ADDED: self.assertTrue(in_renewal_window(30, 30)). TRANSCRIPT: python -m unittest -q -> Ran 4 tests, OK. REVIEW: The diff contains the predicate fix and boundary test only. Human approval is still required before merge.",
      notice: "Passing existing tests did not prove the requirement. The new boundary test and small diff make the acceptance decision visible."
    },
    value: "The manager can evaluate the whole delivery path, including review effort, defects, rework, developer feedback, and tool cost.",
    exercise: {
      prompt: "Review the requirement, failing and passing transcript, and reference diff. Decide whether the change is ready for review. Then define a pilot with suitable tasks, approved repositories, permission mode, review roles, support owner, and evaluation signals.",
      template: "Change decision:\nAcceptance evidence:\nHuman review still needed:\nSuitable pilot tasks:\nApproved repositories and context:\nPermission boundary:\nReviewer:\nSupport owner:\nEvaluation signals:\nExpansion or stop condition:",
      reference: "CHANGE DECISION: Ready for human review. REQUIREMENT: Include 0 through 30 and exclude negative values and day 31. FAILING EVIDENCE: Three original tests pass, then test_includes_day_30 fails with False is not true. REFERENCE DIFF: replace return 0 <= days_remaining < window_days with return 0 <= days_remaining <= window_days and add self.assertTrue(in_renewal_window(30, 30)). PASSING EVIDENCE: Ran 4 tests, OK. SCOPE CHECK: No unrelated hunks. PILOT: Use low-risk scoped tasks in the approved renewal repository with review-required permissions. Jordan Lee, fictional engineering manager, owns the pilot. Priya Shah, fictional reviewer, approves changes. Measure total time through review, rework, escaped defects, developer feedback, and tool cost. Stop on unreviewed changes, broader diffs, or repeated boundary regressions.",
      checks: [
        "The decision cites the new boundary test and full suite",
        "The learner rejects unrelated code changes",
        "The pilot names repositories, permission mode, reviewer, and support owner",
        "Expansion depends on workflow evidence rather than generated-code volume"
      ]
    },
    challenge: {
      prompt: "Review a second diff that fixes day 30 but also renames a helper and changes sort order. The tests pass. Decide what to accept and explain why.",
      reference: "Accept only the boundary test and minimal predicate fix. Reject or split the helper rename and sorting change because they are outside the agreed requirement and lack separate evidence."
    },
    quiz: [
      {
        question: "Why were the original three passing tests insufficient?",
        options: [
          "Three tests can never be useful",
          "They did not exercise the inclusive day-30 requirement",
          "The test runner was too fast"
        ],
        answer: 1,
        rationale: "The missing boundary case allowed the defect to remain while all existing tests passed."
      },
      {
        question: "Which pilot signal is most useful?",
        options: [
          "Lines of generated code",
          "Number of prompts per developer",
          "Total time through review, rework, defects, feedback, and tool cost"
        ],
        answer: 2,
        rationale: "Total time through review, rework, defects, feedback, and tool cost measures the full workflow. The other options can reward activity without quality."
      },
      {
        question: "What should happen to unrelated edits in a passing diff?",
        options: [
          "Reject or split them until they have their own requirement and evidence",
          "Accept them because the suite passes",
          "Hide them from the reviewer"
        ],
        answer: 0,
        rationale: "Passing tests do not establish that unrelated changes belong in the scoped fix."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Frame the business effect of the missing account" },
        { minutes: 6, label: "Trace requirement, predicate, and tests" },
        { minutes: 8, label: "Review failing test, fix, suite, and diff" },
        { minutes: 7, label: "Build the team pilot card" },
        { minutes: 5, label: "Reject or split the broader diff" }
      ],
      checkpoint: "Ask managers to connect the repository change to the shared workflow: Northstar must first be selected before a source-bound brief can be drafted and reviewed.",
      recovery: "Provide the annotated call path, expected 7, 30, and 31 outcome table, transcript, and minimal diff. Ask for one evidence statement before rejoining. Faster learners review the broader diff."
    },
    resources: [
      { label: "Claude Code best practices", url: "https://code.claude.com/docs/en/best-practices" },
      { label: "Claude Code permissions", url: "https://code.claude.com/docs/en/permissions" },
      { label: "Claude Code common workflows", url: "https://code.claude.com/docs/en/common-workflows" }
    ]
  },
  {
    id: "knowledge-worker-cowork",
    title: "Knowledge worker: Produce a reviewed account action brief",
    category: "Business",
    surface: "Claude for Work with a private Project, with Cowork only when enabled",
    minutes: 30,
    summary: "Use four synthetic files to prepare a useful internal brief and draft follow-up while keeping facts, unknowns, actions, and approval separate.",
    outcome: "The learner can produce and verify a source-bound work product without sending a message or changing an external system.",
    task: "Prepare the Northstar action brief and a draft customer follow-up from the CRM, call, support, and usage files.",
    explanation: "Project instructions set the output rules and the files provide shared evidence. A person reviews the result. Cowork may help with a bounded file task when enabled, but it does not change source, permission, or approval duties.",
    demo: {
      title: "A useful draft that keeps gaps visible",
      before: "The four files contain confirmed facts, an open case, a usage change, a missing SSO answer, no security owner, and no discount approval.",
      after: "CONFIRMED FACTS: Renewal January 31, 2027 and $180,000 contract value [CRM]. SSO was asked about [CALL]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The open case and lower use may matter, but no source establishes cause or churn. UNKNOWNS: SSO entitlement, discount approval, and security owner. PROPOSED ACTIONS: Maya verifies pricing, RevOps routes blanks, Marketing removes unsupported claims, and PM tests missing-data behavior. DRAFT EMAIL: We are preparing for the renewal discussion and will confirm the open SSO and support questions before the call. SOURCE CHECK: Every number and product claim maps to one of the four supplied files.",
      notice: "The result remains an internal draft. It does not send a message, update CRM, promise a feature, or assign an unrecorded owner."
    },
    value: "The learner can reduce account-preparation work while keeping the review and evidence trail visible.",
    exercise: {
      prompt: "Create five sections from the four synthetic files: confirmed facts with sources, labeled synthesis, unknowns, proposed actions for AE, RevOps, Marketing, and PM, and a customer email of at most 130 words marked DRAFT. Run a source check on every number, date, product claim, and quotation.",
      template: "CONFIRMED FACTS\n\nSYNTHESIS\n\nUNKNOWNS OR CONFLICTS\n\nPROPOSED ACTIONS\n\nDRAFT CUSTOMER EMAIL\n\nSOURCE CHECK",
      reference: "CONFIRMED FACTS: Renewal January 31, 2027, contract value $180,000, and owner Maya Chen [CRM]. SSO was asked about [CALL]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64 [USAGE]. SYNTHESIS: The support issue and lower use may matter to renewal planning, with no evidence of cause or churn. UNKNOWNS: SSO entitlement, discount approval, and security owner. PROPOSED ACTIONS: Maya verifies package and pricing. RevOps leaves unresolved fields blank and routes them. Marketing rejects churn and endorsement claims. PM checks missing-source and truncated-output behavior. DRAFT CUSTOMER EMAIL: We are preparing for the renewal discussion and will confirm the open SSO and support questions before our call. SOURCE CHECK: CRM supports the date, value, and owner. CALL supports only that SSO was asked about. SUPPORT supports case 4821. USAGE supports 78 to 64. The draft is not sent.",
      checks: [
        "Every number and product claim names a source file",
        "Synthesis and unknowns have separate sections",
        "The output does not promise SSO, pricing, security, or pilot results",
        "No message is sent and no external system is changed"
      ]
    },
    challenge: {
      prompt: "Remove support-summary.md and say that the learner lacks support access. Revise the brief and source check.",
      reference: "State that support status is unavailable, remove case 4821 and case 4794 claims, preserve the remaining sourced facts, and route the gap to an authorized owner. Do not reconstruct the missing file."
    },
    quiz: [
      {
        question: "What belongs in the synthesis section?",
        options: [
          "A claim that the support case caused churn",
          "An invented SSO entitlement",
          "A labeled observation that lower usage and an open case may matter, without claiming cause"
        ],
        answer: 2,
        rationale: "A labeled observation keeps interpretation separate and stays within the evidence."
      },
      {
        question: "When may the draft customer email be sent?",
        options: [
          "As soon as Claude finishes writing it",
          "Only after the named human review and the normal approval process",
          "Whenever every paragraph has a source label"
        ],
        answer: 1,
        rationale: "Source checks help, but the exercise still requires human review and keeps sending outside the workshop."
      },
      {
        question: "What should Cowork change about the evidence standard?",
        options: [
          "Nothing. The same source, permission, and review rules apply",
          "Cowork may fill gaps because it can work across files",
          "Cowork removes the need for a reviewer"
        ],
        answer: 0,
        rationale: "The product surface does not change the factual or approval boundary."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 4, label: "Inspect the four synthetic files" },
        { minutes: 5, label: "Order the shared workflow" },
        { minutes: 7, label: "Demonstrate the five-section brief" },
        { minutes: 8, label: "Draft and run the source check" },
        { minutes: 4, label: "Apply the missing-support challenge" },
        { minutes: 2, label: "Teach back the review boundary" }
      ],
      checkpoint: "Before drafting, ask participants to identify selected records, source-bound draft, review against the records, and use in the existing account process.",
      recovery: "Give a blocked learner the worked five-section brief and ask them to trace one number to its file. Faster learners remove the support file and revise the result."
    },
    resources: [
      { label: "Create and manage Projects", url: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" },
      { label: "Claude Cowork product guide", url: "https://claude.com/resources/guides/claude-cowork-product-guide/product-overview" },
      { label: "Use connectors to extend Claude", url: "https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities" }
    ]
  },
  {
    id: "security-risk",
    title: "Security / Risk: Review a regulated workflow",
    category: "Technical",
    surface: "Claude Platform Messages API",
    minutes: 40,
    summary: "Review a direct Claude API workflow for a synthetic regulated account and make an evidence-based release decision.",
    outcome: "The learner can separate provider and customer controls, identify missing evidence, and allow, revise, or stop a workflow without treating one control as proof of compliance.",
    task: "Review the Northstar regulated-data variation and decide which request may enter the pilot.",
    explanation: "In this direct API pattern, Anthropic operates the model service, compute, and model artifacts. The customer backend owns caller and account access, approved context, tools, queues, application data, deployment, logs, and review. API authentication grants invocation access. It does not grant an employee permission to read Northstar records or make a business decision.",
    demo: {
      title: "A completed security review with a real stop decision",
      before: "The first review says that US inference, an IP allowlist, ZDR, and a BAA make the workflow compliant. It assumes those settings exist, sends synthetic member_id SYN-4471, stores full prompts in application logs, and retries a 403 permission error.",
      after: "DECISION: Allow only the redacted baseline in the offline pilot. Block the sensitive-field variation. EVIDENCE: No signed BAA, HIPAA-ready organization state, ZDR arrangement, or feature eligibility has been shown. DATA: The backend removes member_id before the request and keeps source data in the customer store. REGION: Request inference_geo us and use a US workspace only after the owner verifies both settings. NETWORK: Reach api.anthropic.com over HTTPS and apply the published IP ranges if the firewall requires them. This proves reachability, not private connectivity or authorization. IDENTITY: Use a scoped service account or short-lived workload identity. LOGS: Record the application trace ID, API request ID, workspace, source versions, status, token counts, and latency without prompt text. RELIABILITY: Do not retry 401 or 403. Retry eligible transient failures within a budget. Mark timeouts and interrupted streams incomplete. COST: Use interactive Messages for this reviewed task. Do not use Files or Message Batches until the current eligibility and retention requirements are accepted. OWNER: Security and legal owners resolve the data-handling evidence before the sensitive variant can proceed.",
      notice: "This review makes a bounded product decision. It does not certify the workflow, the customer, or the provider arrangement."
    },
    value: "The team can test a useful workflow while keeping sensitive data, access, connectivity, retention, and release decisions tied to named evidence and owners.",
    exercise: {
      prompt: "Complete the provider and customer control table for networking, security, compute, storage, observability, reliability, infrastructure as code, and cost. Then review a baseline request and a variation that adds synthetic member_id SYN-4471. Decide allow, revise, or stop for each request and name the evidence owner.",
      template: "Request decision:\nSensitive field decision:\nProvider control:\nCustomer control:\nEvidence present:\nEvidence missing:\nFirst technical test:\nRetention and regional check:\nLogging fields:\nRetry and incomplete-output rule:\nCost pattern:\nNamed owner:\nRelease condition:",
      reference: "BASELINE DECISION: Allow in the offline pilot after caller and account checks because it contains only the approved synthetic CRM, support, and usage fields. SENSITIVE VARIANT DECISION: Stop before the API call because member_id SYN-4471 is not needed for the renewal brief and no regulated-data arrangement is evidenced. NETWORKING: Customer firewall permits the documented direct API destination. Permission remains a separate application and workspace check. SECURITY: A scoped service identity may invoke the API, while customer code authorizes the employee, account, records, and tools. COMPUTE: Anthropic runs model inference. Customer runs the backend, record filter, queue, and review workflow. STORAGE: Anthropic operates model artifacts. Customer stores application data and deployment state. Request handling follows the verified model, feature, and organization arrangement. OBSERVABILITY: Customer logs app_trace_id, request_id, workspace_id, source version, status, tokens, and latency. Correlation exists only when the backend propagates those identifiers. RELIABILITY: Timeout is 30 seconds, transient retries are capped at two, 401 and 403 are not retried, and any interrupted output stays visibly incomplete. INFRASTRUCTURE AS CODE: Version the lab policy, learner role, workspace selection, and cleanup steps. Remove synthetic data and revoke temporary access after the lab. COST: Use interactive Messages for the user-waiting path. Consider an asynchronous pattern only for an approved offline workload after reviewing current retention and feature eligibility. RELEASE CONDITION: Security and legal owners document the accepted data fields, signed agreement where required, enabled organization state, feature eligibility, region settings, and logging policy.",
      checks: [
        "The review separates network reachability from API and application permission",
        "The decision does not assume ZDR, a BAA, regional settings, or feature eligibility",
        "Sensitive data is minimized before the API request and excluded from logs",
        "Request IDs correlate with application traces only when the backend propagates them",
        "Timeouts, interrupted output, and permission errors have different handling",
        "The final decision names an evidence owner and a release condition"
      ]
    },
    challenge: {
      prompt: "A signed BAA and HIPAA-ready organization are now confirmed. The team also proposes the Files API, while the customer changes its rule to require private-only connectivity. Reassess the decision using the current feature table and network evidence.",
      reference: "DECISION: Stop the proposed design. A signed BAA does not make every feature eligible. Check the current official feature-eligibility table and the actual signed agreement and organization settings for each selected feature, including Files API. Stop if eligibility is not established. Recheck at decision time rather than relying on the October 30, 2026 source check. The direct API evidence shows a public HTTPS endpoint with fixed IP ranges, not a verified private-only path. Keep eligible content inline through the Messages API only if the signed agreement and organization settings cover it. If private-only connectivity remains mandatory, assign the architecture owner to obtain a supported design from Anthropic before proceeding."
    },
    quiz: [
      {
        question: "What does a successful Claude API credential prove?",
        options: [
          "The employee may read every Northstar record",
          "The credential may invoke the API within its provider scope",
          "The resulting brief is approved for customer use"
        ],
        answer: 1,
        rationale: "Provider authentication covers API invocation. Customer code still checks the employee, account, records, tools, and business approval."
      },
      {
        question: "What does inference_geo set to us establish?",
        options: [
          "That the workflow is sufficient for every regulated use",
          "That every customer and provider record is stored in the same place",
          "That model inference for the request runs in US-based infrastructure"
        ],
        answer: 2,
        rationale: "Inference geography is one control. Workspace storage, endpoint processing, retention, feature eligibility, and customer obligations remain separate."
      },
      {
        question: "Which cost decision fits the reviewed Northstar workflow?",
        options: [
          "Use interactive Messages for the user-waiting brief and assess asynchronous processing separately for approved offline work",
          "Move every request to Message Batches because it costs less",
          "Ignore feature eligibility when the input is synthetic"
        ],
        answer: 0,
        rationale: "Latency, retention, and feature eligibility determine whether an asynchronous pattern fits. Price alone does not decide the architecture."
      }
    ],
    facilitator: {
      agenda: [
        { minutes: 5, label: "Frame the regulated Northstar decision and identify the sensitive variation" },
        { minutes: 7, label: "Map provider and customer controls across the eight review areas" },
        { minutes: 8, label: "Inspect the completed allow and stop decisions" },
        { minutes: 10, label: "Review both requests and name missing evidence and owners" },
        { minutes: 6, label: "Apply the BAA, Files API, and private-connectivity change" },
        { minutes: 4, label: "Defend one release condition and one first technical test" }
      ],
      checkpoint: "Ask participants to place the policy gate around the shared workflow: select approved records, request a source-bound draft, review it against the records, and use the reviewed output in the existing process.",
      recovery: "Give a blocked learner the completed control table and the 403 trace. Ask them to distinguish reachability, provider permission, and application access before rejoining. Give a faster learner the changed BAA, Files API, and private-connectivity case."
    },
    resources: [
      { label: "Feature eligibility", url: "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention#feature-eligibility" },
      { label: "Data residency", url: "https://platform.claude.com/docs/en/manage-claude/data-residency" },
      { label: "Authentication", url: "https://platform.claude.com/docs/en/manage-claude/authentication" },
      { label: "API IP addresses", url: "https://platform.claude.com/docs/en/api/ip-addresses" },
      { label: "API errors and request IDs", url: "https://platform.claude.com/docs/en/api/errors" },
      { label: "Batch processing", url: "https://platform.claude.com/docs/en/build-with-claude/batch-processing" }
    ]
  }
];
