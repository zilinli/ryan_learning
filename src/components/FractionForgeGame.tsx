"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateRecipe,
  validateCraft,
  difficultyFromPKnown,
  fractionSkillSeed,
  type FractionRecipe,
} from "@/lib/entertain/fraction-forge";
import {
  loadLearningMemory,
  applyMisconceptionToMemory,
  saveLearningMemory,
  pushLearningMemoryToServer,
} from "@/lib/learning-memory";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

const COLOR_BARS = ["#46a758", "#e89440", "#3b82f6", "#ec4899", "#8b5cf6"];

function fractionBar(
  num: number,
  den: number,
  maxWidth = 200,
  color = "#46a758",
) {
  const ratio = Math.min(1, Math.max(0, num / den));
  return (
    <div className="flex items-center gap-2">
      <div
        className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--mist)]"
        style={{ width: maxWidth, height: 32 }}
      >
        <div
          className="h-full rounded-lg transition-all duration-500"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm tabular-nums text-[var(--ink)]">
        {num}/{den}
      </span>
    </div>
  );
}

export function FractionForgeGame() {
  const [recipe, setRecipe] = useState<FractionRecipe | null>(null);
  const [phase, setPhase] = useState<"idle" | "crafting" | "forged" | "defect">("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userNum, setUserNum] = useState("");
  const [userDen, setUserDen] = useState("");
  const [message, setMessage] = useState("");
  const [accountId, setAccountId] = useState("acct_ryan");
  const forgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const acct = getActiveAccount(loadAccounts());
      setAccountId(acct.id);
    } catch { /* use default */ }
  }, []);

  const startRecipe = useCallback(() => {
    const mem = loadLearningMemory(accountId);
    const fracSkill = mem.skills?.find(
      (s) => s.id === "fractions-concepts" || s.id === "equivalent-fractions",
    );
    const pKnown = fracSkill?.pKnown ?? 0.5;
    const diff = difficultyFromPKnown(pKnown);
    const r = generateRecipe(diff);
    setRecipe(r);
    setPhase("crafting");
    setUserNum("");
    setUserDen("");
    setMessage("");
  }, [accountId]);

  const handleForge = useCallback(async () => {
    if (!recipe || phase !== "crafting") return;
    const num = parseInt(userNum, 10);
    const den = parseInt(userDen, 10);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
      setMessage("Enter both parts of the fraction (like 5/6)");
      return;
    }

    const result = validateCraft(recipe, num, den);

    if (result.correct) {
      setPhase("forged");
      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => s + 1);
      setMessage(`Perfect forge! ${recipe.name} created.`);

      // BKT: correct outcome
      void recordStudioLearningTurn({
        accountId,
        source: "writing",
        title: `Fraction Forge · ${recipe.name}`,
        userText: fractionSkillSeed(recipe),
        outcome: "correct",
      });
    } else {
      setPhase("defect");
      setStreak(0);
      const defectMsg = result.misconceptionId
        ? "The forge sputters — check your fraction parts."
        : `${recipe.name} came out defective. Try again!`;
      setMessage(defectMsg);

      // BKT: incorrect + misconception
      void recordStudioLearningTurn({
        accountId,
        source: "writing",
        title: `Fraction Forge · ${recipe.name}`,
        userText: fractionSkillSeed(recipe),
        outcome: "incorrect",
      });

      if (result.misconceptionId) {
        const mem = loadLearningMemory(accountId);
        const next = applyMisconceptionToMemory(
          mem,
          recipe.op === "add" || recipe.op === "subtract"
            ? "fractions-concepts"
            : "fraction-word-problems",
          { id: result.misconceptionId, label: result.misconceptionId, description: "" },
        ) as typeof mem;
        saveLearningMemory(next, accountId);
        void pushLearningMemoryToServer(next, accountId);
      }

      // Auto-recover after 1.5s
      setTimeout(() => {
        setPhase("crafting");
        setUserNum("");
        setUserDen("");
        setMessage("");
      }, 1500);
    }
  }, [recipe, phase, userNum, userDen, streak, accountId]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 py-8">
      {/* Score bar */}
      <div className="mb-6 flex w-full items-center justify-between gap-4 text-sm">
        <span className="text-[var(--ink-muted)]">
          Score: <span className="tabular-nums font-semibold text-[var(--ink)]">{score}</span>
        </span>
        {streak > 1 && (
          <span className="rounded-full bg-[var(--coral)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--coral)]">
            {streak}x streak
          </span>
        )}
      </div>

      {/* Recipe card */}
      {recipe && (phase === "crafting" || phase === "forged" || phase === "defect") ? (
        <div
          ref={forgeRef}
          className={`w-full rounded-2xl border-2 bg-[var(--surface)] p-5 shadow-sm transition ${
            phase === "forged"
              ? "border-[var(--teal)]/50 shadow-[var(--teal)]/20"
              : phase === "defect"
                ? "border-[var(--coral)]/40"
                : "border-[var(--line)]"
          }`}
        >
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
            {phase === "forged" ? "Forged!" : phase === "defect" ? "Defective" : "Crafting"}
          </h2>

          <div className="mt-3 space-y-3">
            {/* Visual fraction bars */}
            {recipe.parts.map(([n, d], i) => (
              fractionBar(n, d, 200, COLOR_BARS[i % COLOR_BARS.length])
            ))}
          </div>

          <p className="mt-3 text-[13px] text-[var(--ink-muted)]">{recipe.question}</p>

          {phase === "crafting" && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                value={userNum}
                onChange={(e) => setUserNum(e.target.value)}
                placeholder="num"
                className="w-16 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1.5 text-center text-sm text-[var(--ink)]"
              />
              <span className="text-lg text-[var(--ink-muted)]">/</span>
              <input
                type="number"
                value={userDen}
                onChange={(e) => setUserDen(e.target.value)}
                placeholder="den"
                className="w-16 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1.5 text-center text-sm text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={handleForge}
                disabled={!userNum || !userDen}
                className="ml-2 min-h-11 rounded-xl bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Forge
              </button>
            </div>
          )}

          {phase !== "crafting" && (
            <button
              type="button"
              onClick={startRecipe}
              className="mt-4 min-h-11 rounded-xl bg-[var(--action-bg)] px-4 text-sm font-medium text-[var(--action-ink)]"
            >
              {phase === "forged" ? "Next recipe" : "Try again"}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-6 text-5xl">⚒️</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
            Fraction Forge
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--ink-muted)]">
            Craft magical gear by solving fraction recipes. Drag, slice, and forge!
          </p>
          <button
            type="button"
            onClick={startRecipe}
            className="mt-6 min-h-12 rounded-xl bg-[var(--teal)] px-6 text-sm font-semibold text-white"
          >
            Start forging
          </button>
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <p className={`mt-4 text-center text-sm ${
          phase === "forged" ? "text-[var(--teal)]" : phase === "defect" ? "text-[var(--coral)]" : "text-[var(--ink-muted)]"
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}
