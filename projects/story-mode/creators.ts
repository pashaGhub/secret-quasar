// Creators & contributors shown under the Story Mode section. The list lives in creators.json and
// is edited from /lab/story-mode (dev only), which saves it back through a dev-only route; commit the
// JSON to publish it. Everything that reads or writes the list goes through normalizeCreators().
import data from "./creators.json";

export type Creator = {
  name: string;
  role: string;
  /** Profile / site link (https://…, mailto:…, or a /path on this site). Empty → not clickable. */
  url: string;
  /** Avatar image URL or /path (e.g. https://github.com/<user>.png). Empty → initials. */
  avatar: string;
};

export const MAX_CREATORS = 60;
const MAX_LEN = { name: 60, role: 80, url: 300, avatar: 300 } as const;

/** Only http(s), mailto and same-site paths are allowed as links (no javascript: etc.). */
export function safeHref(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\/[^\s]+$/i.test(u) || /^mailto:[^\s]+$/i.test(u)) return u;
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u;
  return null;
}

/** Avatars: http(s) or same-site paths only. */
export function safeSrc(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(u) || /^\/(?!\/)[^\s]*$/.test(u)) return u;
  return null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** Coerce unknown input (JSON file, POST body) to a clean list. Rows without a name are dropped. */
export function normalizeCreators(input: unknown): Creator[] {
  if (!Array.isArray(input)) return [];
  const out: Creator[] = [];
  for (const row of input.slice(0, MAX_CREATORS)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const str = (k: keyof typeof MAX_LEN) => (typeof r[k] === "string" ? (r[k] as string).trim().slice(0, MAX_LEN[k]) : "");
    // unsafe links / image sources are dropped, never stored
    const c: Creator = { name: str("name"), role: str("role"), url: safeHref(str("url")) ?? "", avatar: safeSrc(str("avatar")) ?? "" };
    if (!c.name) continue;
    out.push(c);
  }
  return out;
}

export const CREATORS: Creator[] = normalizeCreators(data);
