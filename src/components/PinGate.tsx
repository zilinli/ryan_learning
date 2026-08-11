"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkAdultChallenge,
  clearParentPin,
  createAdultChallenge,
  hasParentPin,
  PARENT_PIN_LENGTH,
  saveParentPin,
  unlockParentSession,
  verifyParentPin,
  type AdultChallenge,
} from "@/lib/adult-gate";

type Mode = "pin" | "adult-reset";

type Props = {
  onUnlock: (pin: string) => void;
  onCancel: () => void;
  /** When true, force create / change-PIN flow. */
  forceCreate?: boolean;
};

const LOCK_MS = 30000;

export { hasParentPin } from "@/lib/adult-gate";

export function verifyPin(pin: string) {
  return verifyParentPin(pin);
}

/**
 * Parent gate — YouTube Kids / Google kids-app pattern:
 * - Routine: 4-digit PIN, auto-advance on 4th digit
 * - Session unlock (caller + unlockParentSession) so we don't nag every tap
 * - Forgot PIN: adult math/year challenge BEFORE clear+recreate (kids can't one-tap reset)
 */
export function PinGate({ onUnlock, onCancel, forceCreate = false }: Props) {
  const [createMode, setCreateMode] = useState(
    () => forceCreate || !hasParentPin(),
  );
  const isNew = createMode;
  const [mode, setMode] = useState<Mode>("pin");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [err, setError] = useState("");
  const [att, setAtt] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shake, setShake] = useState(false);
  const [challenge, setChallenge] = useState<AdultChallenge | null>(null);
  const [adultAnswer, setAdultAnswer] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitting = useRef(false);

  const locked = secondsLeft > 0;

  useEffect(() => {
    if (lockUntil <= 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      if (remaining <= 0) {
        setLockUntil(0);
        setAtt(0);
        setError("");
        setSecondsLeft(0);
      } else {
        setSecondsLeft(remaining);
      }
    };
    tick();
    timer.current = setInterval(tick, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [lockUntil]);

  const fail = useCallback((message: string) => {
    setError(message);
    setShake(true);
    window.setTimeout(() => setShake(false), 600);
  }, []);

  const finishUnlock = useCallback(
    (digits: string) => {
      unlockParentSession();
      onUnlock(digits);
    },
    [onUnlock],
  );

  const trySubmit = useCallback(
    (nextPin: string, nextConfirm: string, nextConfirming: boolean) => {
      if (submitting.current) return;
      if (isNew) {
        if (!nextConfirming && nextPin.length === PARENT_PIN_LENGTH) {
          setConfirming(true);
          setConfirm("");
          setError("");
          return;
        }
        if (nextConfirming && nextConfirm.length === PARENT_PIN_LENGTH) {
          if (nextConfirm !== nextPin) {
            fail("Those didn't match — try again");
            setPin("");
            setConfirm("");
            setConfirming(false);
            return;
          }
          submitting.current = true;
          saveParentPin(nextPin);
          finishUnlock(nextPin);
        }
        return;
      }
      if (nextPin.length === PARENT_PIN_LENGTH) {
        if (!verifyParentPin(nextPin)) {
          const a = att + 1;
          setAtt(a);
          setPin("");
          if (a >= 3) {
            setLockUntil(Date.now() + LOCK_MS);
            setSecondsLeft(LOCK_MS / 1000);
            setError("Too many tries — wait a moment");
          } else {
            fail(`Wrong PIN · ${3 - a} left`);
          }
          return;
        }
        submitting.current = true;
        finishUnlock(nextPin);
      }
    },
    [isNew, att, fail, finishUnlock],
  );

  const press = useCallback(
    (d: string) => {
      if (lockUntil > Date.now() || shake || submitting.current) return;
      if (isNew) {
        if (confirming) {
          const next = (confirm + d).slice(0, PARENT_PIN_LENGTH);
          setConfirm(next);
          trySubmit(pin, next, true);
        } else {
          const next = (pin + d).slice(0, PARENT_PIN_LENGTH);
          setPin(next);
          trySubmit(next, confirm, false);
        }
      } else {
        const next = (pin + d).slice(0, PARENT_PIN_LENGTH);
        setPin(next);
        trySubmit(next, confirm, false);
      }
    },
    [isNew, confirming, pin, confirm, lockUntil, shake, trySubmit],
  );

  const back = useCallback(() => {
    if (isNew && confirming) setConfirm((p) => p.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
  }, [isNew, confirming]);

  const startAdultReset = () => {
    setMode("adult-reset");
    setChallenge(createAdultChallenge());
    setAdultAnswer("");
    setError("");
  };

  const submitAdultReset = () => {
    if (!challenge) return;
    if (!checkAdultChallenge(challenge, adultAnswer)) {
      fail("Not quite — try another question");
      setChallenge(createAdultChallenge());
      setAdultAnswer("");
      return;
    }
    clearParentPin();
    submitting.current = false;
    setCreateMode(true);
    setMode("pin");
    setPin("");
    setConfirm("");
    setConfirming(false);
    setError("");
    setAtt(0);
    setAdultAnswer("");
    setChallenge(null);
  };

  if (mode === "adult-reset" && challenge) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,28,34,0.45)] px-3 pb-3 sm:items-center sm:pb-0">
        <div
          className={`w-full max-w-sm rounded-2xl bg-[var(--surface)] p-5 shadow-xl${
            shake ? " animate-[shake_0.4s_ease-in-out]" : ""
          }`}
          role="dialog"
          aria-modal="true"
        >
          <h2 className="text-center text-lg font-semibold text-[var(--ink)]">
            Adult check
          </h2>
          <p className="mt-1 text-center text-[12px] leading-snug text-[var(--ink-muted)]">
            Like YouTube Kids — prove you&apos;re a grown-up before resetting
            the PIN. Kids shouldn&apos;t pass this easily.
          </p>
          <p className="mt-4 rounded-xl bg-[var(--mist)] px-3 py-3 text-center text-[15px] font-medium text-[var(--ink)]">
            {challenge.prompt}
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={adultAnswer}
            onChange={(e) => setAdultAnswer(e.target.value)}
            className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3 text-center text-[16px] tabular-nums text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            placeholder="Your answer"
            aria-label="Answer"
          />
          {err ? (
            <p className="mt-2 text-center text-xs font-medium text-[var(--coral)]">
              {err}
            </p>
          ) : null}
          <button
            type="button"
            onClick={submitAdultReset}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--teal)] text-sm font-semibold text-white"
          >
            Continue — then set a new PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("pin");
              setError("");
            }}
            className="mt-2 w-full py-2 text-[12px] text-[var(--ink-muted)]"
          >
            Back to PIN
          </button>
        </div>
      </div>
    );
  }

  const title = isNew
    ? confirming
      ? "Type it once more"
      : forceCreate
        ? "Choose a new PIN"
        : "Set a parent PIN"
    : "Parents only";

  const hint = isNew
    ? confirming
      ? "Same 4 digits to confirm."
      : "Keeps digests, check mode, and Code Agent apply behind a grown-up lock."
    : "Unlocked for this browser tab until you lock or close it.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,28,34,0.45)] px-3 pb-3 sm:items-center sm:pb-0">
      <div
        className={`w-full max-w-sm rounded-2xl bg-[var(--surface)] p-5 shadow-xl${
          shake ? " animate-[shake_0.4s_ease-in-out]" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-gate-title"
      >
        <div className="mb-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Parent gate
          </p>
          <h2
            id="pin-gate-title"
            className="mt-0.5 text-lg font-semibold text-[var(--ink)]"
          >
            {title}
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--ink-muted)]">
            {hint}
          </p>
        </div>

        <div className="mb-3 flex justify-center gap-2.5">
          {[0, 1, 2, 3].map((i) => {
            const len = isNew && confirming ? confirm.length : pin.length;
            return (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition ${
                  i < len ? "bg-[var(--teal)]" : "bg-[var(--ink-muted)]/20"
                }`}
              />
            );
          })}
        </div>

        {err ? (
          <p className="mb-2 text-center text-xs font-medium text-[var(--coral)]">
            {locked ? `Wait ${secondsLeft}s` : err}
          </p>
        ) : (
          <p className="mb-2 text-center text-[11px] text-[var(--ink-muted)]">
            {isNew && confirming
              ? "Confirm · auto-saves at 4 digits"
              : isNew
                ? "Step 1 of 2 · auto-continues"
                : "Enter 4 digits"}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              disabled={locked}
              onClick={() => press(d)}
              className="flex h-12 items-center justify-center rounded-xl bg-[var(--mist)] text-lg font-semibold text-[var(--ink)] hover:bg-[var(--mist)]/80 active:scale-95 disabled:opacity-30"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center justify-center rounded-xl text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--coral)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => press("0")}
            className="flex h-12 items-center justify-center rounded-xl bg-[var(--mist)] text-lg font-semibold text-[var(--ink)] hover:bg-[var(--mist)]/80 active:scale-95 disabled:opacity-30"
          >
            0
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={back}
            className="flex h-12 items-center justify-center rounded-xl text-lg text-[var(--ink-muted)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-30"
            aria-label="Delete digit"
          >
            ←
          </button>
        </div>

        {!isNew ? (
          <button
            type="button"
            onClick={startAdultReset}
            className="mt-3 w-full text-center text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            Forgot PIN? Adult check to reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
