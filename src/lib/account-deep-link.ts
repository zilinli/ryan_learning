/**
 * Deep-link helpers for `?account=` (and optional `?session=`).
 *
 * Used so shared / bookmarked URLs open the right student profile and that
 * account's chat sessions — even when the browser was last used by someone else.
 */
import {
  RYAN_ACCOUNT_ID,
  switchAccount,
  type AccountRecord,
  type AccountsStore,
} from "./student-profile";

const MAX_PARAM_LEN = 80;

/** Raw `account` query value (id, "default", or profile name/slug). */
export function accountDeepLinkParamFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const a = (new URLSearchParams(window.location.search).get("account") || "").trim();
    if (!a || a.length > MAX_PARAM_LEN) return null;
    // Reject path-like / injection junk; allow ids, names, and simple slugs.
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(a)) return null;
    return a;
  } catch {
    return null;
  }
}

function nameSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

/**
 * Resolve a deep-link param to an account id.
 * Prefers exact id, then case-insensitive profile name, then name slug.
 * Returns `acct_*` ids even when not yet in `accounts` (pending server hydrate).
 */
export function resolveDeepLinkAccountId(
  param: string | null | undefined,
  accounts: AccountRecord[],
): string | null {
  if (!param) return null;
  const raw = param.trim();
  if (!raw || raw.length > MAX_PARAM_LEN) return null;

  if (raw === "default") return RYAN_ACCOUNT_ID;

  if (accounts.some((a) => a.id === raw)) return raw;

  if (/^acct_[A-Za-z0-9_-]+$/.test(raw)) return raw;

  const lower = raw.toLowerCase();
  const byName = accounts.find((a) => a.profile.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;

  const slug = nameSlug(raw);
  const bySlug = accounts.find((a) => nameSlug(a.profile.name) === slug);
  return bySlug?.id ?? null;
}

export type AccountDeepLinkResult = {
  store: AccountsStore;
  /** Resolved target id (may be unset when param missing/invalid). */
  accountId: string | null;
  /** True when the target exists in `store.accounts` (switch applied if needed). */
  matched: boolean;
};

/**
 * Switch the accounts store to the deep-link target when present in the list.
 * Persists via `switchAccount` when the active id changes.
 */
export function applyAccountDeepLink(
  store: AccountsStore,
  param?: string | null,
): AccountDeepLinkResult {
  const raw = param === undefined ? accountDeepLinkParamFromUrl() : param;
  const accountId = resolveDeepLinkAccountId(raw, store.accounts);
  if (!accountId) {
    return { store, accountId: null, matched: false };
  }
  if (!store.accounts.some((a) => a.id === accountId)) {
    return { store, accountId, matched: false };
  }
  if (store.activeId === accountId) {
    return { store, accountId, matched: true };
  }
  return { store: switchAccount(accountId, store), accountId, matched: true };
}
