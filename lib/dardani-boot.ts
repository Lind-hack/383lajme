// Session flag for the first-load Dardani cover (components/dardani/page-loader).
// A plain module, not the client component, so the server layout can read the
// value itself: a string exported from a "use client" file reaches a server
// component as a client reference, not as the string.
export const BOOTED_KEY = "383:booted";
