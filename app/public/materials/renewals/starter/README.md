# Fictional renewal-window lab

This small Python exercise uses synthetic account data and has no network calls or credentials.

The customer requirement is inclusive. An account with 0 through 30 days remaining belongs in a 30-day renewal window. An account with 31 days or a negative number does not.

The starter implementation has a boundary defect. Existing tests miss exactly 30 days. Ask Claude Code to inspect the files, propose a regression test, show the failure, make the smallest fix, rerun the checks, and explain the change.

Run the starter checks from this folder:

```sh
python3 -m unittest discover -s tests -v
```

For a standalone version-control demo, copy this folder to a disposable directory and create a local repository there before using Claude Code. Keep the exercise uncommitted after the fix. A prompt is a scope instruction. The actual Claude Code permission settings control access and execution.
