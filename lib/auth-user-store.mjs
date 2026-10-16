// Browser display state only. Protected data continues to use server auth.
export function createAuthUserStore() {
  let snapshot = {user: null, ready: false};
  const serverSnapshot = snapshot;
  const listeners = new Set();
  let started = false;
  let revision = 0;
  const publish = user => {
    snapshot = {user, ready: true};
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {listeners.add(listener);return () => listeners.delete(listener);},
    acceptUser(user) {revision++;publish(user);},
    start(auth) {
      if (started) return;
      started = true;
      if (!auth) {publish(null);return;}
      const initialRevision = revision;
      auth.onAuthStateChange((event, session) => {
        // Initial reads must never erase a sign-in/sign-out that already won.
        if (event === 'INITIAL_SESSION' && revision > 0) return;
        revision++;
        publish(session?.user ?? null);
      });
      auth.getSession().then(({data}) => {
        if (initialRevision === 0 && revision === initialRevision) {
          revision++;
          publish(data.session?.user ?? null);
        }
      }).catch(() => {
        if (initialRevision === 0 && revision === initialRevision) publish(null);
      });
    },
  };
}
