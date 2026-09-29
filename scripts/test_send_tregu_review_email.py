import importlib.util
import unittest
from pathlib import Path
from unittest.mock import MagicMock


spec = importlib.util.spec_from_file_location(
    "tregu_review_email", Path(__file__).with_name("send-tregu-review-email.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TreguReviewEmailTests(unittest.TestCase):
    def test_sends_html_receipt_through_gmail_smtp(self):
        smtp = MagicMock()
        smtp.__enter__.return_value.send_message.return_value = {}
        factory = MagicMock(return_value=smtp)
        module.send_email(
            "reader@example.com",
            "383 Tregu test",
            "<h1>Daily run</h1><p>Created: 0</p>",
            env={"GMAIL_USER": "sender@example.com", "GMAIL_APP_PASSWORD": " abcd efgh "},
            smtp_factory=factory,
        )
        factory.assert_called_once()
        smtp.__enter__.return_value.login.assert_called_once_with("sender@example.com", "abcdefgh")
        message = smtp.__enter__.return_value.send_message.call_args.args[0]
        self.assertEqual(message["To"], "reader@example.com")
        self.assertIn("Daily run", message.get_body(preferencelist=("html",)).get_content())

    def test_missing_credentials_fail_instead_of_claiming_delivery(self):
        with self.assertRaisesRegex(RuntimeError, "GMAIL_USER"):
            module.send_email("reader@example.com", "receipt", "<p>Body</p>", env={})

    def test_refused_recipient_fails(self):
        smtp = MagicMock()
        smtp.__enter__.return_value.send_message.return_value = {"reader@example.com": (550, "refused")}
        with self.assertRaisesRegex(RuntimeError, "refused"):
            module.send_email(
                "reader@example.com", "receipt", "<p>Body</p>",
                env={"GMAIL_USER": "sender@example.com", "GMAIL_APP_PASSWORD": "secret"},
                smtp_factory=MagicMock(return_value=smtp),
            )


if __name__ == "__main__":
    unittest.main()
