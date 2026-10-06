// Friends sign in with a name + password. Supabase Auth needs an email, so
// each name maps to a placeholder address on the reserved `.invalid` TLD
// (RFC 2606): it can never receive mail, and nobody ever sees it.
export const LOGIN_DOMAIN = "players.thegreatcheckin.invalid";

/** "Big Mike" → "bigmike". Case and spaces don't matter when signing in. */
export function loginHandle(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** Problem with a name, or null if it's usable. */
export function loginNameProblem(name: string): string | null {
  const h = loginHandle(name);
  if (h.length < 2) return "Name needs at least 2 characters.";
  if (h.length > 24) return "Keep the name under 24 characters.";
  if (!/^[a-z0-9._-]+$/.test(h)) return "Use letters, numbers, dots, dashes or underscores.";
  return null;
}

/** What to hand Supabase. Anything with an @ is treated as a real email (older accounts). */
export function loginEmail(nameOrEmail: string): string {
  const v = nameOrEmail.trim();
  return v.includes("@") ? v.toLowerCase() : `${loginHandle(v)}@${LOGIN_DOMAIN}`;
}

/** Turn the stored address back into the name you sign in with. */
export function handleFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  return email.endsWith("@" + LOGIN_DOMAIN) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email;
}
