"""Run on the Supabase host with sudo. Creates/deletes its own account; sends no mail."""
import json
import secrets
import urllib.error
import urllib.request
from pathlib import Path


def main():
    env = dict(
        line.split("=", 1) for line in Path("/opt/383-supabase/current/.env").read_text().splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )
    service_key = env["SERVICE_ROLE_KEY"].strip("\"'")
    base = "http://127.0.0.1:8000/auth/v1"

    def request(path, method="POST", body=None, token=service_key):
        req = urllib.request.Request(base + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"apikey": service_key, "Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, {}

    email = "codex-recovery-" + secrets.token_hex(8) + "@example.com"
    old_password = secrets.token_urlsafe(24)
    new_password = secrets.token_urlsafe(24)
    user_id = None
    try:
        status, user = request("/admin/users", body={"email": email, "password": old_password, "email_confirm": True})
        assert status in (200, 201), f"Create test account: HTTP {status}"
        user_id = user["id"]
        status, link = request("/admin/generate_link", body={"type": "recovery", "email": email})
        assert status == 200, f"Generate recovery token: HTTP {status}"
        token_hash = link["hashed_token"]
        status, session = request("/verify", body={"type": "recovery", "token_hash": token_hash})
        assert status == 200 and session.get("access_token"), f"Verify recovery: HTTP {status}"
        print("PASS: real Auth service verifies a recovery token")
        status, _ = request("/user", method="PUT", body={"password": new_password}, token=session["access_token"])
        assert status == 200, f"Update password: HTTP {status}"
        status, _ = request("/token?grant_type=password", body={"email": email, "password": new_password})
        assert status == 200, f"New password login: HTTP {status}"
        status, _ = request("/token?grant_type=password", body={"email": email, "password": old_password})
        assert status == 400, f"Old password should fail: HTTP {status}"
        print("PASS: new password signs in; previous password is rejected")
        status, _ = request("/verify", body={"type": "recovery", "token_hash": token_hash})
        assert status in (400, 403), f"Consumed recovery token should fail: HTTP {status}"
        print("PASS: consumed recovery link cannot be reused")
    finally:
        if user_id:
            status, _ = request("/admin/users/" + user_id, method="DELETE")
            assert status in (200, 204), f"Delete test account: HTTP {status}"
            print("PASS: temporary test account deleted")


if __name__ == "__main__":
    main()
