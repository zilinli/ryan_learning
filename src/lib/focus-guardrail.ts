/**
 * P2 — non-blocking focus guardrail (report §9.2.3).
 * When a worksheet plan is in progress, entering Games shows a gentle one-line
 * nudge ("homework still has N questions — finish, then play?") — no lock, no
 * penalty. Dismissible once per day per account.
 */

import { kvGet, kvSet } from "./browser-kv";
import { loadAccounts } from "./student-profile";
import { accountIdFromUrl, loadConversations } from "./storage";
import { RYAN_ACCOUNT } from "./tenant-storage";
import { isWorksheetComplete, type WorksheetPlan } from "./worksheet-planner";
import type { ConversationRecord } from "./types";

export type FocusGuardrailInfo = {
  sessionId: string;
  total: number;
  current: number;
  remaining: number;
  line: string;
};

const DISMISS_KEY_PREFIX = "spark.focusGuardrail.dismiss.";

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function focusGuardrailDismissKey(accountId: string): string {
  return `${DISMISS_KEY_PREFIX}${accountId || RYAN_ACCOUNT}`;
}

/** Resolve the active account id: explicit → URL → active account store. */
export function resolveGuardrailAccountId(accountId?: string): string {
  if (accountId && /^acct_[A-Za-z0-9_-]+$/.test(accountId)) return accountId;
  const fromUrl = accountIdFromUrl();
  if (fromUrl) return fromUrl;
  try {
    const store = loadAccounts();
    if (store?.activeId) return store.activeId;
  } catch {
    /* fall through */
  }
  return RYAN_ACCOUNT;
}

/** Extract an in-progress worksheet plan from the active conversation. */
export function activeWorksheetPlan(
  accountId?: string,
  conversations?: ConversationRecord[],
  activeId?: string,
): WorksheetPlan | null {
  if (!conversations || !activeId) {
    const aid = resolveGuardrailAccountId(accountId);
    try {
      const store = loadConversations(aid);
      if (!store) return null;
      conversations = store.conversations;
      activeId = store.activeId;
    } catch {
      return null;
    }
  }
  const conv = conversations.find((c) => c.sessionId === activeId);
  const plan = conv?.worksheetPlan as WorksheetPlan | undefined;
  if (!plan || isWorksheetComplete(plan)) return null;
  return plan;
}

/** Build the guardrail card for an in-progress worksheet, or null. */
export function buildFocusGuardrail(
  accountId?: string,
  conversations?: ConversationRecord[],
  activeId?: string,
): FocusGuardrailInfo | null {
  const plan = activeWorksheetPlan(accountId, conversations, activeId);
  if (!plan) return null;
  const remaining = Math.max(0, plan.total - plan.current);
  const line =
    remaining > 0
      ? `Homework still has ${remaining} question${remaining === 1 ? "" : "s"} — finish, then play?`
      : "Homework is almost done — one more, then play?";
  return {
    sessionId: activeId || "",
    total: plan.total,
    current: plan.current,
    remaining,
    line,
  };
}

/** Dismiss the nudge for the rest of today (respects student autonomy). */
export function dismissFocusGuardrail(accountId: string): void {
  kvSet(focusGuardrailDismissKey(accountId), localDateKey());
}

export function dismissFocusGuardrailForToday(accountId: string): void {
  dismissFocusGuardrail(accountId);
}

/** True when the nudge was already dismissed today for this account. */
export function dismissedFocusGuardrailToday(
  accountId: string,
  now = new Date(),
): boolean {
  return kvGet(focusGuardrailDismissKey(accountId)) === localDateKey(now);
}
