"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onUnlock: (pin: string) => void;
  onCancel: () => void;
};

function hash(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i);
    h |= 0;
  }
  return "spark_" + Math.abs(h).toString(36);
}

export function hasParentPin() {
  try {
    return !!localStorage.getItem("spark.parentPin");
  } catch {
    return false;
  }
}

export function verifyPin(pin: string) {
  return hash(pin) === (localStorage.getItem("spark.parentPin") || "");
}

const PIN_LENGTH = 4;
const LOCK_MS = 30000;

export function PinGate({ onUnlock, onCancel }: Props) {
  const [isNew] = useState(() => !hasParentPin());
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setError] = useState("");
  const [att, setAtt] = useState(0);
  // Lockout target timestamp (ms) — only ever read inside event handlers.
  const [lockUntil, setLockUntil] = useState(0);
  // Countdown mirrored into state so render never calls the impure Date.now().
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shake, setShake] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const press = useCallback(
    (d: string) => {
      if (lockUntil > Date.now() || shake) return;
      if (isNew) {
        if (confirm) setConfirm((p) => (p + d).slice(0, PIN_LENGTH));
        else setPin((p) => (p + d).slice(0, PIN_LENGTH));
      } else {
        setPin((p) => (p + d).slice(0, PIN_LENGTH));
      }
    },
    [isNew, confirm, lockUntil, shake],
  );

  const back = useCallback(() => {
    if (isNew && confirm) setConfirm((p) => p.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
  }, [isNew, confirm]);

  const submit = useCallback(() => {
    if (isNew) {
      if (pin.length < PIN_LENGTH) {
        fail("Need 4 digits");
        return;
      }
      if (!confirm) {
        setConfirm("");
        return;
      }
      if (confirm !== pin) {
        setError("PINs don't match");
        setPin("");
        setConfirm("");
        setShake(true);
        window.setTimeout(() => setShake(false), 600);
        return;
      }
      localStorage.setItem("spark.parentPin", hash(pin));
      onUnlock(pin);
    } else {
      if (pin.length < PIN_LENGTH) {
        fail("Enter 4 digits");
        return;
      }
      if (!verifyPin(pin)) {
        const a = att + 1;
        setAtt(a);
        setPin("");
        if (a >= 3) {
          setLockUntil(Date.now() + LOCK_MS);
          setSecondsLeft(LOCK_MS / 1000);
          setError("Too many tries");
        } else {
          fail(`Wrong. ${3 - a} left`);
        }
        return;
      }
      onUnlock(pin);
    }
  }, [isNew, pin, confirm, att, fail, onUnlock]);

  const confirmDots = (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-3 w-3 rounded-full bg-[var(--ink-muted)]/30" />
      ))}
      <div className="mx-2 text-[var(--ink-muted)]">→</div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full ${
            i < confirm.length ? " bg-[var(--teal)]" : " bg-[var(--ink-muted)]/20"
          }`}
        />
      ))}
    </>
  );

  const pinDots = [0, 1, 2, 3].map((i) => (
    <div
      key={i}
      className={`h-4 w-4 rounded-full ${
        i < pin.length ? " bg-[var(--teal)]" : " bg-[var(--ink-muted)]/15"
      }`}
    />
  ));

  const submitDisabled =
    locked ||
    (isNew && !confirm ? pin.length < PIN_LENGTH : (confirm ? confirm.length : pin.length) < PIN_LENGTH);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,34,0.5)] px-4">
      <div
        className={`w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-xl${
          shake ? " animate-[shake_0.4s_ease-in-out]" : ""
        }`}
      >
        <div className="mb-4 text-center">
          <span className="text-3xl">🔐</span>
          <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
            {isNew && !confirm ? "Set parent PIN" : isNew ? "Confirm PIN" : "Enter PIN"}
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {isNew ? "Choose 4 digits to keep changes safe." : "PIN needed to apply changes."}
          </p>
        </div>

        <div className="mb-4 flex justify-center gap-2">
          {isNew && confirm ? confirmDots : pinDots}
        </div>

        {err ? (
          <p className="mb-3 text-center text-xs font-medium text-[var(--coral)]">
            {locked ? `⏳ ${secondsLeft}s` : err}
          </p>
        ) : null}

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
          >
            ←
          </button>
        </div>

        <button
          type="button"
          disabled={submitDisabled}
          onClick={submit}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--teal)] px-4 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-40"
        >
          {isNew && !confirm ? "Set PIN" : isNew ? "Confirm" : "Unlock"}
        </button>

        {!isNew ? (
          <button
            type="button"
            onClick={() =>
              setError("Clear localStorage key spark.parentPin in DevTools, then refresh.")
            }
            className="mt-3 w-full text-center text-[11px] text-[var(--ink-muted)] hover:underline"
          >
            Forget PIN?
          </button>
        ) : null}
      </div>
    </div>
  );
}
