// Node-only half of instrumentation.ts (see there).
export async function startTreguHeartbeatBackup() {
  const { backupEnabled, backupTick, BACKUP_CHECK_EVERY_MS } = await import("@/lib/tregu-heartbeat-backup.mjs");
  if (!backupEnabled()) return;

  const state = {};
  const tick = async () => {
    try {
      const [{ createAdminClient }, { runLiveSportsAutomation }] = await Promise.all([
        import("@/lib/supabase/admin"),
        import("@/lib/tregu-automation-server"),
      ]);
      const admin = createAdminClient();
      if (!admin) return;
      await backupTick({
        state,
        lastRunAt: async () => {
          const { data, error } = await admin.from("market_automation_runs")
            .select("started_at").eq("action", "live_sports")
            .order("started_at", { ascending: false }).limit(1).maybeSingle();
          if (error) throw new Error(error.message);
          return data?.started_at ?? null;
        },
        run: () => runLiveSportsAutomation(new Date()),
      });
    } catch (error) {
      console.error("[tregu-heartbeat] check failed:", error instanceof Error ? error.message : String(error));
    }
  };
  // The first look waits a minute, so a fresh deploy is serving before it works.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), BACKUP_CHECK_EVERY_MS).unref?.();
  }, 60_000).unref?.();
}
