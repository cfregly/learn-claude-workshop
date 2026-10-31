# Northstar security and regulated workflow review

This is a proposed 40-minute offline design review for security, risk, architecture, and engineering learners. Northstar Freight, every person, every identifier, and every decision record in this file are synthetic.

The exercise reviews a proposed direct Claude Messages API design on paper. Do not make a live API call or enter credentials for this exercise. It does not claim that a design, customer, or provider arrangement is compliant. Learners make an allow, revise, or stop decision from evidence.

## Learning outcome

By the end, a learner can:

- separate API reachability, provider authentication, application authorization, and business approval
- identify which controls belong to Anthropic and which remain in the customer application
- review retention, feature eligibility, geography, logging, reliability, and cost without assuming a configuration exists
- stop a sensitive request when the required agreement, setting, feature, or network evidence is missing
- name the owner and evidence required to restart the review

## Synthetic Northstar inputs

### Baseline request

```text
[CRM] Northstar Freight renews on January 31, 2027. Maya Chen is the account owner.
[SUPPORT] Case 4821 for delayed shipment-alert emails is open.
[USAGE] Weekly active users are 64, down from 78 in the prior period.
[TASK] Draft an internal renewal brief. Keep the discount and SSO status unknown.
```

### Sensitive-field variation

```text
[SENSITIVE, SYNTHETIC] member_id=SYN-4471
[SENSITIVE, SYNTHETIC] service_detail=home infusion delivery
```

The sensitive fields are not needed to prepare the renewal brief. The reference design blocks them before the API request. The exercise does not assume a signed agreement, ZDR arrangement, HIPAA-ready organization, approved feature set, or regional setting.

## Direct API responsibility map

In this simplified design, Anthropic operates the model service, inference compute, and model artifacts. The customer operates the application backend, caller and account checks, source stores, record filter, queues, tools, application deployment, logs, and human review.

| Review area | Anthropic service boundary | Customer application responsibility | Northstar workshop decision |
| --- | --- | --- | --- |
| Networking | The direct API is reached at `api.anthropic.com` over HTTPS. Anthropic publishes fixed inbound and outbound IP ranges for firewall rules. | Permit the required destination, validate DNS and TLS, and decide whether the customer's network policy accepts public HTTPS. | IP allowlisting supports reachability control. It does not prove authorization or a private connection. Stop if private-only connectivity is mandatory and no supported private design is evidenced. |
| Security | API keys or short-lived workload identity authorize API invocation within provider scope. | Authenticate the employee, authorize the account and records, validate tool arguments, protect credentials, and require business approval. | Use a scoped service identity. Run the Northstar account-access check before selecting records. Do not treat a successful API credential as customer-data permission. |
| Compute | Anthropic runs Claude model inference and manages the service capacity behind the API. | Run and scale the backend, source retrieval, policy gate, queues, tool execution, and review interface. | Keep one small backend call path. Do not add model-hosting infrastructure to the lab. |
| Storage | Anthropic's request handling depends on the organization arrangement, model, endpoint, and feature. Anthropic operates the model artifacts. | Store application data, deployed code and configuration, selected context, outputs, and audit records under customer policy. | Keep account records in the customer store. Send only the approved minimum. Verify retention and feature eligibility before a sensitive request. |
| Observability | API responses provide a request ID and usage information. Organization usage and cost reporting is available through separate administrative interfaces. | Create an application trace ID, propagate and record the API request ID, and log safe metadata such as workspace, source version, status, latency, and token counts. | Correlation exists only when the backend carries the identifiers across the boundary. Do not log prompt text or synthetic member fields. |
| Reliability | The API reports HTTP errors, stop reasons, request IDs, and possible stream errors after HTTP 200. | Set timeouts, understand SDK retry behavior, keep one bounded retry budget, withhold incomplete output, and reconcile before any side effect. | Use a 30-second lab timeout. Retry eligible transient failures at most twice. Do not retry 401 or 403. Mark timeout, `max_tokens`, and interrupted stream output incomplete. |
| Infrastructure as code | Provider organization and workspace settings are configured in Claude Platform. | Version the lab deployment, policy, learner role, workspace selection, alerting, and cleanup steps. | Give learners only the lab permissions they need. Remove synthetic data and revoke temporary access after the lab. |
| Cost | Interactive Messages return results in the user path. Message Batches provide an asynchronous option and currently use discounted batch pricing. | Choose a pattern from latency, volume, retention, and eligibility needs. Attribute usage to the correct workspace and application route. | Use interactive Messages for the reviewed brief. Consider batches only for an approved offline workload after checking the current data-handling feature table. |

## Completed review

**Decision:** Allow the redacted baseline in the offline pilot. Stop the sensitive-field variation before any API call.

**Reason:** The baseline has the approved synthetic account fields needed for the task. `member_id` and `service_detail` are not needed. No evidence in the exercise establishes a signed BAA, HIPAA-ready organization, ZDR arrangement, eligible feature set, or accepted regional and network design.

**Proposed request path, offline walkthrough:**

Walk through the following design steps without executing them. The separate opt-in live streaming lab has its own setup and limits.

1. Authenticate the employee.
2. Check access to `northstar-freight`.
3. Select the approved baseline records.
4. Block fields tagged `SENSITIVE` for this pilot.
5. Identify where the proposed customer backend would send one bounded request to `/v1/messages`. Do not send it during this review.
6. Record safe response metadata and require a complete terminal state.
7. Route the draft to the account reviewer. No CRM write occurs in the workshop.

**Credential decision:** Use a workspace-scoped service account or an approved short-lived workload identity. Store no credential in the notebook, browser, source pack, or logs.

**Regional decision:** If the customer requires US inference, send `inference_geo: "us"` and verify the response usage field. Verify the workspace geo separately. Neither setting alone establishes regulatory sufficiency.

**Retention decision:** Review the current model, endpoint, feature, and organization arrangement in the official feature table. Do not summarize the result as every API request being ZDR. Do not assume that a signed BAA covers every API feature.

**Logging decision:** Record `app_trace_id`, provider `request_id`, workspace, selected source versions, status, stop reason, latency, and token counts. Exclude prompts, outputs, account identifiers beyond the approved synthetic ID, and the sensitive variation.

**Release condition:** Security and legal owners must document the accepted data fields, signed agreement where required, enabled organization state, eligible features, regional settings, logging policy, and network design before the sensitive path can be reconsidered.

## Prepared failure trace

All identifiers below are synthetic.

```text
time=2026-10-25T16:02:00Z
app_trace_id=northstar-sec-017
caller_account_access=allow
selected_record_set=baseline-v1
sensitive_fields_selected=0
destination=api.anthropic.com
http_status=403
error_type=permission_error
request_id=req_synthetic_017
output_state=not_created
retry_count=0
```

**Diagnosis:** The HTTP response shows that the application reached the API. The provider rejected the credential's permission for the requested resource. The customer application had separately allowed the employee to read the synthetic account. These are different controls.

**First inspection:** Check the service identity, workspace scope, model access, and request headers. Do not retry the same 403. Do not change the customer account-access rule to fix a provider permission failure.

**Learning check:** Ask the learner to identify one reachability fact, one provider-permission fact, one customer-access fact, and the next owner.

## Changed-boundary challenge

A security owner now confirms a signed BAA and a HIPAA-ready organization. The product team proposes the Files API for the source document. The customer also changes the network requirement to private-only connectivity.

### Reference decision

Stop the proposed design.

- A signed BAA does not make every feature eligible. Check the current feature table for each endpoint and feature.
- The current official table does not list the Files API as HIPAA eligible.
- The direct API documentation shows a public HTTPS endpoint and fixed IP ranges. That evidence does not establish private-only connectivity.
- Inline content through the Messages API may be reconsidered only if the signed agreement, enabled organization, model, request features, and customer policy all cover it.
- If private-only connectivity remains mandatory, the architecture owner must obtain a supported design from Anthropic before the pilot proceeds.

## Facilitator sequence

1. **5 minutes:** Introduce the business decision and the sensitive variation.
2. **7 minutes:** Assign the eight responsibility rows to pairs.
3. **8 minutes:** Walk through the completed allow and stop decisions.
4. **10 minutes:** Have learners review both requests and name evidence owners.
5. **6 minutes:** Apply the BAA, Files API, and private-connectivity change.
6. **4 minutes:** Each learner states one release condition and one first technical test.

Give a blocked learner the completed responsibility map and 403 trace. The rejoin point is the distinction between reachability, provider permission, and customer access. Give a faster learner the changed-boundary challenge.

## Official sources checked October 25, 2026

- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) describes ZDR and HIPAA readiness, feature eligibility, exclusions, model-specific retention, and the signed BAA as the governing agreement.
- [Commercial data retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) describes the standard commercial retention period and its exceptions, including separately agreed ZDR arrangements.
- [Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency) separates per-request inference geography from workspace storage and endpoint-processing geography.
- [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication) describes API keys, service identities, workspace scope, and Workload Identity Federation.
- [IP addresses](https://platform.claude.com/docs/en/api/ip-addresses) publishes fixed IP ranges for firewall rules. It does not describe those ranges as private connectivity.
- [Claude API errors](https://platform.claude.com/docs/en/api/errors) documents error types, request IDs, SDK retry behavior, long-request guidance, and stream errors after HTTP 200.
- [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) describes organization-level usage and cost reporting.
- [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing) describes asynchronous processing, throughput, and discounted batch pricing. Review its current retention eligibility before use.

Recheck these pages before delivery because eligibility, models, regions, pricing, and product behavior can change.
