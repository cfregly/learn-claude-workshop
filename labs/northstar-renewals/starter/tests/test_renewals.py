import unittest

from src.renewals import in_renewal_window


class RenewalWindowTests(unittest.TestCase):
    def test_inside_window(self):
        self.assertTrue(in_renewal_window(7, 30))

    def test_outside_window(self):
        self.assertFalse(in_renewal_window(31, 30))

    def test_expired_account(self):
        self.assertFalse(in_renewal_window(-1, 30))


if __name__ == "__main__":
    unittest.main()
