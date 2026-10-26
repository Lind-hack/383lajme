// Read-only production report. Supply CRON_SECRET through the environment.
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is required to read the private retention report.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch('https://383ks.com/api/analytics/usage?report=per-ty', {
      headers: { authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Report returned HTTP ${response.status}`);
    const report = await response.json();
    if (!Array.isArray(report.cohorts)) throw new Error('Retention report is not deployed yet');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Report unavailable');
    process.exitCode = 1;
  }
}
