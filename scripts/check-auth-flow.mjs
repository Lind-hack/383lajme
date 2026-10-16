// Local browser contract tests. Auth is intercepted; no emails are sent and no accounts are changed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3105";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Run mocked auth checks against localhost only");
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find(fs.existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext();
  let recoveryRequest;
  let updatedPassword;
  let authorizeUrl;
  let rejectRecovery = true;
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "auth-test@example.com", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "test-signature"].join(".");
  await context.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    let status = 200;
    let body = {};
    if (path.endsWith("/authorize")) {
      authorizeUrl = new URL(request.url());
      return route.fulfill({ contentType: "text/html", body: "Google authorization intercepted" });
    }
    if (path.endsWith("/recover")) {
      recoveryRequest = { body: request.postDataJSON(), url: new URL(request.url()) };
      if (rejectRecovery) { status = 429; body = { msg: "email rate limit exceeded" }; }
    }
    if (path.endsWith("/token")) body = { access_token: jwt, refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user };
    if (path.endsWith("/user")) {
      body = user;
      if (request.method() === "PUT") updatedPassword = request.postDataJSON().password;
    }
    return route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/hyr?next=/tregu`);
  const google = page.getByRole("button", { name: "Hyr me Google", exact: true });
  const microsoft = page.getByRole("button", { name: "Hyr me Microsoft", exact: true });
  await google.waitFor();
  assert.equal(await microsoft.count(), 0, "Microsoft login removed");
  await google.click();
  await page.waitForURL((url) => url.pathname.endsWith("/authorize"));
  assert.equal(authorizeUrl.searchParams.get("provider"), "google");
  assert.equal(new URL(authorizeUrl.searchParams.get("redirect_to")).searchParams.get("next"), "/tregu");
  console.log("PASS Microsoft login removed; Google login preserves return destination");

  await page.goto(`${base}/hyr`);
  await page.getByRole("link", { name: "Ke harruar fjalëkalimin?" }).click();
  await page.getByLabel("Email", { exact: true }).fill("Auth-Test@Example.com");
  await page.getByRole("button", { name: "Dërgo linkun", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Shumë kërkesa" }).waitFor();
  rejectRecovery = false;
  await page.getByRole("button", { name: "Dërgo linkun", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "noreply@383ks.com" }).waitFor();
  assert.equal(recoveryRequest.body.email, "auth-test@example.com");
  const redirect = new URL(recoveryRequest.url.searchParams.get("redirect_to"));
  assert.equal(redirect.pathname, "/auth/callback");
  assert.equal(redirect.searchParams.get("next"), "/hyr/fjalekalimi?mode=reset");
  assert.ok(await page.getByRole("button", { name: /Dërgo përsëri/ }).isDisabled());
  console.log("PASS recovery request, rate-limit feedback, noreply message and resend cooldown");

  await page.goto(`${base}/hyr/fjalekalimi?mode=reset`);
  await page.getByRole("alert").filter({ hasText: "Linku ka skaduar" }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Ruaj fjalëkalimin" }).isDisabled());
  console.log("PASS missing-session recovery blocks password updates");

  await page.goto(`${base}/hyr?next=${encodeURIComponent("/hyr/fjalekalimi?mode=reset")}`);
  await page.getByPlaceholder("Email", { exact: true }).fill(user.email);
  await page.getByPlaceholder("Fjalëkalimi", { exact: true }).fill("Old-password-123!");
  await page.getByRole("button", { name: "Hyr", exact: true }).last().click();
  await page.waitForURL("**/hyr/fjalekalimi?mode=reset");
  await page.getByLabel("Fjalëkalimi i ri", { exact: true }).fill("New-password-123!");
  await page.getByLabel("Përsërit fjalëkalimin", { exact: true }).fill("Different-password!");
  await page.getByRole("button", { name: "Ruaj fjalëkalimin" }).click();
  await page.getByRole("alert").filter({ hasText: "Fjalëkalimet nuk përputhen" }).waitFor();
  assert.equal(updatedPassword, undefined);
  await page.getByLabel("Përsërit fjalëkalimin", { exact: true }).fill("New-password-123!");
  await page.getByRole("button", { name: "Ruaj fjalëkalimin" }).click();
  await page.getByRole("status").filter({ hasText: "Fjalëkalimi u ndryshua" }).waitFor();
  assert.equal(updatedPassword, "New-password-123!");
  console.log("PASS password mismatch prevention and successful password update");
  assert.deepEqual(errors, [], "No browser runtime errors");
  await context.close();
} finally {
  await browser.close();
}
