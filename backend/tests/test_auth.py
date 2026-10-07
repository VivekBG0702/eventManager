import unittest

from core.security import hash_password, verify_password


class SecurityAuthTests(unittest.TestCase):
    def test_bcrypt_handles_long_passwords_without_error(self):
        password = "a" * 200

        hashed_password = hash_password(password)

        self.assertTrue(verify_password(password, hashed_password))


if __name__ == "__main__":
    unittest.main()
