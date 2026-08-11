/**
 * Parent PIN + session unlock helpers (shared across devices' localStorage;
 * unlock is sessionStorage so one unlock lasts for the tab).
 */

const PIN_KEY = "spark.parentPin";
const SESSION_KEY = "spark.parentUnlocked";

export const PARENT_PIN_LENGTH = 4;

export function hashParentPin(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i);
    h |= 0;
  }
  return "spark_" + Math.abs(h).toString(36);
}

export function hasParentPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
}

export function verifyParentPin(pin: string): boolean {
  try {
    return hashParentPin(pin) === (localStorage.getItem(PIN_KEY) || "");
  } catch {
    return false;
  }
}

export function saveParentPin(pin: string): void {
  localStorage.setItem(PIN_KEY, hashParentPin(pin));
}

/** Clears PIN on this browser. Caller should also lock the session. */
export function clearParentPin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
  lockParentSession();
}

export function isParentSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockParentSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function lockParentSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const CHECK_MODE_KEY = "spark.checkMode";

/** Check-answers mode — session-scoped so Family page and tutor share it. */
export function loadCheckMode(): boolean {
  try {
    return sessionStorage.getItem(CHECK_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCheckMode(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(CHECK_MODE_KEY, "1");
    else sessionStorage.removeItem(CHECK_MODE_KEY);
  } catch {
    /* ignore */
  }
}
