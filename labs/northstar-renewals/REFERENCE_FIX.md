# Reference fix and test instructions

## Acceptance criteria

For a 30-day window:

- Day 0 is included.
- Day 7 is included.
- Day 30 is included.
- Day 31 is excluded.
- Negative values are excluded.

## Reproduce the missing coverage

From `starter/`, run:

```sh
python3 -m unittest discover -s tests -v
```

The three original tests pass because they cover day 7, day 31, and day `-1`. They do not prove the day-30 requirement.

Add this regression test before editing `src/renewals.py`:

```python
def test_inclusive_boundary(self):
    self.assertTrue(in_renewal_window(30, 30))
```

Run the tests again. The new test must fail because the starter uses `< window_days`.

## Smallest implementation change

Change:

```python
return 0 <= days_remaining < window_days
```

to:

```python
return 0 <= days_remaining <= window_days
```

Run the focused test, then run the full suite. Four tests must pass. Review the diff and reject unrelated edits.

## Optional validation

Review a second proposed diff that also renames the function or changes output ordering. Even if tests pass, split or reject those unrelated edits because they are outside the acceptance criteria.
