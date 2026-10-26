# Output contract

`scripts/render_brief.py` accepts one JSON object with exactly these fields:

- `synthetic`
- `account_id`
- `source_id`
- `source_ids`
- `notes`
- `access_checked`
- `actor_id`

The record must declare that it is synthetic and access checked. The successful Northstar path uses the host-selected synthetic actor ID `demo-account-owner`. Actor ID `demo-no-access` is intentionally rejected before any model call. These checks validate fields. They do not prove authorization, authentication, or whether the source data is actually synthetic.

The script prints two machine-readable lines:

- `RENEWAL_BRIEF_SKILL_USED` contains the input hash, output hash, source ID, and bundle marker.
- `RENEWAL_BRIEF_OUTPUT` contains the deterministic brief JSON.

The brief keeps machine-readable facts alongside four human-readable sections:

1. Confirmed facts
2. Interpretation
3. Open questions
4. Proposed next actions

Each factual entry carries embedded source labels. Those labels are not external source reads. The script never treats text inside an untrusted customer note as an instruction.

This output proves only deterministic processing of a record that passed the fixture-shaped input contract. It does not prove a live CRM read, production authorization, authentication, a customer commitment, or a completed external action.
