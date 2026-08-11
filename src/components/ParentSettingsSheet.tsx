"use client";

import { useEffect, useMemo, useState } from "react";
import type { LearningMemory } from "@/lib/learning-memory";
import { normalizeMemory } from "@/lib/learning-memory";
import { buildParentWeeklyDigest } from "@/lib/parent-digest";
import {
  checkAdultChallenge,
  clearParentPin,
  createAdultChallenge,
  hasParentPin,
  isParentSessionUnlocked,
  lockParentSession,
  unlockParentSession,
  type AdultChallenge,
} from "@/lib/adult-gate";
import { PinGate } from "./PinGate";

type Props = {
  open: boolean;
  onClose: () => void;
  memory: LearningMemory | null;
  checkMode?: boolean;
  onCheckModeChange?: (on: boolean) => void;
};

/**
 * Parent hub — visible entry (industry: don't bury controls), gated surface
 * for digests / check mode / PIN management.
 */
export function ParentSettingsSheet({
  open,
  onClose,
  memory,
  checkMode = false,
  onCheckModeChange,
}: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetStep, setResetStep] = useState<"idle" | "challenge">("idle");
  const [challenge, setChallenge] = useState<AdultChallenge | null>(null);
  const [adultAnswer, setAdultAnswer] = useState("");
  const [resetErr, setResetErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setPinSet(hasParentPin());
    const ok = isParentSessionUnlocked() && hasParentPin();
    setUnlocked(ok);
    setResetStep("idle");
    setResetErr("");
    if (!ok) {
      setForceCreate(false);
      setShowPin(true);
    } else {
      setShowPin(false);
    }
  }, [open]);

  const mem = useMemo(
    () => (memory ? normalizeMemory(memory) : null),
    [memory],
  );
  const weekly = useMemo(() => buildParentWeeklyDigest(mem), [mem]);

  if (!open) return null;

  const afterUnlock = () => {
    unlockParentSession();
    setUnlocked(true);
    setPinSet(true);
    setShowPin(false);
    setForceCreate(false);
  };

  const lock = () => {
    lockParentSession();
    setUnlocked(false);
    onCheckModeChange?.(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(10,28,34,0.4)]"
        aria-label="Close parent settings"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[22px] bg-[var(--surface)] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)]/60 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Parents
            </p>
            <h2 className="text-[17px] font-semibold text-[var(--ink)]">
              Family controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 min-w-10 rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {!unlocked ? (
            <div className="space-y-3 text-[13px] text-[var(--ink-muted)]">
              <p className="rounded-xl bg-[var(--mist)] px-3 py-2 text-[12px] leading-snug text-[var(--ink)]">
                Same idea as YouTube Kids / Screen Time: a short PIN keeps
                adult tools away from kids. After unlock, this tab stays open
                until you lock or close the browser.
              </p>
              <p className="text-[12px]">
                {pinSet
                  ? "Enter your 4-digit PIN — it auto-unlocks when you finish."
                  : "First time: pick any 4 digits, then type them again."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setForceCreate(false);
                  setShowPin(true);
                }}
                className="min-h-12 w-full rounded-xl bg-[var(--teal)] text-[14px] font-semibold text-white"
              >
                {pinSet ? "Enter PIN" : "Set PIN now"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--teal)]/25 bg-[var(--teal)]/5 px-3 py-2 text-[12px] text-[var(--teal)]">
                Unlocked this tab · Lock when you hand the device back
              </div>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  This week
                </h3>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[var(--mist)] p-3 text-[12px] leading-relaxed text-[var(--ink)]">
                  {weekly.text}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(weekly.text).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className="mt-2 min-h-10 rounded-lg border border-[var(--line)] px-3 text-[12px]"
                >
                  {copied ? "Copied" : "Copy summary"}
                </button>
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Tools
                </h3>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] px-3 text-[13px]">
                  <input
                    type="checkbox"
                    checked={checkMode}
                    onChange={(e) => onCheckModeChange?.(e.target.checked)}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Check answers (show full solutions in chat)
                </label>
                <a
                  href="/dashboard"
                  className="flex min-h-12 items-center rounded-xl border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)]"
                >
                  Open learning dashboard →
                </a>
              </section>

              <section className="space-y-2 border-t border-[var(--line)]/60 pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Safety
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setForceCreate(true);
                    setShowPin(true);
                  }}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-left text-[13px]"
                >
                  Change PIN
                </button>
                <button
                  type="button"
                  onClick={lock}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-left text-[13px] font-medium"
                >
                  Lock now (hand device back)
                </button>

                {resetStep === "idle" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChallenge(createAdultChallenge());
                      setAdultAnswer("");
                      setResetErr("");
                      setResetStep("challenge");
                    }}
                    className="min-h-11 w-full rounded-xl px-3 text-left text-[12px] text-[var(--ink-muted)]"
                  >
                    Forgot PIN? Adult check to reset…
                  </button>
                ) : (
                  <div className="rounded-xl border border-[var(--coral)]/25 bg-[var(--coral)]/5 p-3">
                    <p className="text-[12px] font-medium text-[var(--ink)]">
                      Adult check (kids should struggle here)
                    </p>
                    <p className="mt-2 text-[14px] text-[var(--ink)]">
                      {challenge?.prompt}
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={adultAnswer}
                      onChange={(e) => setAdultAnswer(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px]"
                      placeholder="Answer"
                    />
                    {resetErr ? (
                      <p className="mt-1 text-[11px] text-[var(--coral)]">
                        {resetErr}
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!challenge) return;
                          if (!checkAdultChallenge(challenge, adultAnswer)) {
                            setResetErr("Try another question");
                            setChallenge(createAdultChallenge());
                            setAdultAnswer("");
                            return;
                          }
                          clearParentPin();
                          lockParentSession();
                          setPinSet(false);
                          setUnlocked(false);
                          onCheckModeChange?.(false);
                          setResetStep("idle");
                          setForceCreate(true);
                          setShowPin(true);
                        }}
                        className="min-h-10 flex-1 rounded-lg bg-[var(--coral)] text-[12px] font-semibold text-white"
                      >
                        Reset & set new PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetStep("idle")}
                        className="min-h-10 flex-1 rounded-lg border border-[var(--line)] text-[12px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {showPin ? (
        <PinGate
          forceCreate={forceCreate || !pinSet}
          onUnlock={() => afterUnlock()}
          onCancel={() => {
            setShowPin(false);
            setForceCreate(false);
          }}
        />
      ) : null}
    </div>
  );
}
