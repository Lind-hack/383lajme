import importlib.util
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("dosje_cron_report", __file__.replace("test_dosje_cron_report.py", "dosje_cron_report.py"))
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)

def test_compose_escapes_payload_and_keeps_exact_json():
    os.environ["GMAIL_USER"] = "bot@example.com"
    msg = MOD.compose("research", 422, {"reason": "<script>alert(1)</script>", "drafted": 0}, "https://github.com/run/1", "schedule", "lindsylqa@gmail.com")
    html_part = msg.get_payload()[1].get_payload(decode=True).decode("utf-8")
    text_part = msg.get_payload()[0].get_payload(decode=True).decode("utf-8")
    assert "&lt;script&gt;" in html_part
    assert "<script>alert(1)</script>" in text_part
    assert "drafted=0" in msg["Subject"]

def test_main_emails_allowed_422_and_returns_success():
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.dumps({"ok": False, "reason": "no_sources", "found": 1}).encode()
            self.send_response(422)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        def log_message(self, *_args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    captured = []
    old = {key: os.environ.get(key) for key in ["GMAIL_USER", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL"]}
    os.environ.update({"GMAIL_USER": "bot@example.com", "GMAIL_APP_PASSWORD": "not-used", "RECIPIENT_EMAIL": "lindsylqa@gmail.com"})
    try:
        with patch.object(MOD, "send", lambda message: captured.append(message)):
            rc = MOD.main(["--stage", "research", "--url", f"http://127.0.0.1:{server.server_port}/research", "--secret", "test-secret", "--allowed-status", "200,422"])
        assert rc == 0
        assert len(captured) == 1
        assert "no_sources" in captured[0].get_payload()[0].get_payload(decode=True).decode("utf-8")
    finally:
        server.shutdown()
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

if __name__ == "__main__":
    test_compose_escapes_payload_and_keeps_exact_json()
    test_main_emails_allowed_422_and_returns_success()
    print("2 Dosje reporter tests passed")
