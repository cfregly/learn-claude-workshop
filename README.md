# Northstar workshop materials

This repository contains the synthetic code, notebooks, fixtures, and teaching references for the Northstar workshop. Northstar Freight, its records, people, identifiers, traces, and decisions are fictional.

Everything needed for the core labs runs offline with Python 3 and the standard library. A live Claude API call is optional and is not required to complete the workshop.

## Start here

1. Read the [Northstar source pack](docs/northstar-source-pack.md).
2. Open the [API trace notebook](labs/api-trace.ipynb) and run its cells from top to bottom.
3. Run the direct API client in offline mode:

   ```bash
   python3 labs/claude_api_demo.py
   ```

4. Open the [renewal-window starter lab](labs/northstar-renewals/starter/README.md), add the missing boundary test, and compare your work with the [reference fix](labs/northstar-renewals/REFERENCE_FIX.md).

## Files

### Teaching references

- [Synthetic Northstar source pack](docs/northstar-source-pack.md)
- [Facilitator guide](docs/facilitator-guide.md)
- [Security and regulated workflow review](docs/security-workshop.md)

### API lab

- [Offline API trace notebook](labs/api-trace.ipynb)
- [Direct Claude API client with offline default](labs/claude_api_demo.py)
- [Four synthetic evaluation fixtures](labs/source-fixtures.json)

### Claude Code boundary lab

- [Lab overview](labs/northstar-renewals/README.md)
- [Starter instructions](labs/northstar-renewals/starter/README.md)
- [Starter implementation](labs/northstar-renewals/starter/src/renewals.py)
- [Starter tests](labs/northstar-renewals/starter/tests/test_renewals.py)
- [Reference fix and validation](labs/northstar-renewals/REFERENCE_FIX.md)
- [Reference solution](labs/northstar-renewals/solution/README.md)

## Offline validation

Run the starter tests:

```bash
cd labs/northstar-renewals/starter
python3 -m unittest discover -s tests -q
```

Run the reference solution tests:

```bash
cd labs/northstar-renewals/solution
python3 -m unittest discover -s tests -q
```

The API notebook and default client use only synthetic data. Do not place credentials, customer data, or private interview notes in this repository.

## Audience adaptations

Use the [Claude for Work activity](docs/claude-for-work.md) for a private Project and role task. Compare the [incomplete response lesson](docs/incomplete-response.md) to see how engineers and sales managers judge the same failure through different evidence. The [live API lab](labs/live-api/README.md) contains the actual server, bounded Claude request handler, and focused tests used by the site.

Follow the [streaming and tool-use trace](docs/streaming-lab.md), then use the [thinking lesson](docs/thinking-lab.md) to distinguish model capabilities, effort, output budget, display, and preserved tool-turn blocks. The [capability excerpt](docs/model-capabilities.json) is dated evidence from the Models API.
