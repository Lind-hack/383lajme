// Runs once when a Next.js server starts. Used for one thing: the Tregu sports
// heartbeat's backup engine (lib/tregu-heartbeat-backup.mjs), which takes over
// the two-minute live odds refresh whenever the VPS timer stops calling it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTreguHeartbeatBackup } = await import("./instrumentation-node");
    await startTreguHeartbeatBackup();
  }
}
