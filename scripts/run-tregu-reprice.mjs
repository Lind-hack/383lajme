const baseUrl = process.env.TREGU_AUTOMATION_URL;
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;

if (!baseUrl || !secret) {
  console.error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  process.exit(1);
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/automation/tregu/reprice`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await response.text();
console.log(body);
process.exit(response.ok ? 0 : 1);
