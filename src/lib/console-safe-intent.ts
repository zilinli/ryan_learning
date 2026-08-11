/**
 * Code Agent child-safe intent helpers (AUDIT8.7).
 * Keep the agent; only gate clearly destructive ops behind parent PIN in the UI.
 */

/** Kid/parent-friendly chips — no push/deploy/wipe language. */
export const SAFE_SUGGESTIONS: string[] = [
  "Make the chat text easier to read on a phone",
  "Add a clearer button when Spark is thinking",
  "Fix the homework photo crop on mobile",
  "Show math steps one by one",
  "Make the empty chat welcome friendlier",
];

const DESTRUCTIVE_RE =
  /\b(publish[_ ]?develop|deploy[_ ]?live|revert[_ ]?changes|force[- ]?push|git\s+push|pm2\s+restart|delete\s+all|rm\s+-rf|drop\s+database|wipe\s+(the\s+)?(repo|site|data))\b/i;

const DESTRUCTIVE_ZH =
  /发布到(线上|生产)|推送(到)?\s*develop|部署上线|撤销全部|强制推送|删掉全部|清空仓库/;

/** True when the user message asks for publish / deploy / revert / wipe-class ops. */
export function looksDestructive(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return DESTRUCTIVE_RE.test(t) || DESTRUCTIVE_ZH.test(t);
}

/**
 * Whether the panel should show PinGate before sending.
 * If the parent session is already unlocked this tab, skip.
 */
export function needsParentPinForConsole(
  text: string,
  parentSessionUnlocked: boolean,
): boolean {
  if (parentSessionUnlocked) return false;
  return looksDestructive(text);
}
