// Demo instance credentials: the one place to change when the demo data changes.
// The demo usernames are looked up by role through the API at setup, so none are listed here.

/** The roles the tests sign in as, in walk order. */
export const ROLES = ["super-admin", "admin", "staff", "nurse"] as const;
export type Role = (typeof ROLES)[number];

export const SUPER_ADMIN_USERNAME = "super-admin";

/** Every demo account shares this password. The super-admin has none until its first sign-in sets one. */
export const DEMO_PASSWORD = "demo123";
