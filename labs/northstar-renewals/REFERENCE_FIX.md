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

Before editing `src/renewals.py`, add this method inside the existing `RenewalWindowTests` class in `starter/tests/test_renewals.py` (the `tests/test_renewals.py` file when your current directory is `starter/`). Keep the four-space method indentation:

```python
    def test_inclusive_boundary(self):
        self.assertTrue(in_renewal_window(30, 30))
```

From `starter/`, run just that test through the actual unittest collector:

```sh
python3 -m unittest discover -s tests -p test_renewals.py -k test_inclusive_boundary -v
```

It must collect one test and fail because the starter uses `< window_days`. A module-level function with this name is not a method of the TestCase and will not establish this regression check.

## Smallest implementation change

Change:

```python
return 0 <= days_remaining < window_days
```

to:

```python
return 0 <= days_remaining <= window_days
```

From `starter/`, run the focused test again, then the full suite:

```sh
python3 -m unittest discover -s tests -p test_renewals.py -k test_inclusive_boundary -v
python3 -m unittest discover -s tests -v
```

The focused command must collect and pass one test. The full suite must collect and pass four tests. Review the diff and reject unrelated edits.

## Optional validation

Review a second proposed diff that also renames the function or changes output ordering. Even if tests pass, split or reject those unrelated edits because they are outside the acceptance criteria.
