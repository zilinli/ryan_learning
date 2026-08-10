import { describe, expect, it } from "vitest";
import {
  planPedagogyLoop,
  prioritizeMisconceptionHits,
  WEAK_PKNOWN_THRESHOLD,
} from "./pedagogy-loop";
import { buildTutorPrompt } from "./prompts";
import {
  emptyLearningMemory,
  recordLearningTurnMemory,
  type LearningMemory,
} from "./learning-memory";
import { DEFAULT_ELO, DEFAULT_SM2 } from "./bkt";
import { looksLikeStillStuck } from "./multi-rep";

function memWeakFrac(): LearningMemory {
  const base = emptyLearningMemory();
  const now = Date.now();
  return {
    ...base,
    skills: [
      {
        id: "fractions-concepts",
        label: "fractions concepts",
        topicId: "fractions",
        pKnown: 0.32,
        mastery: 32,
        attempts: 8,
        correct: 2,
        incorrect: 6,
        lastSeen: now,
        sm2State: { ...DEFAULT_SM2, prevReview: now - 86400000 },
        eloState: { ...DEFAULT_ELO, lastUpdate: now },
        misconceptionHits: [
          { id: "frac-add-denom", count: 3, lastSeen: now },
        ],
      },
      {
        id: "geometry-measure",
        label: "geometry measure",
        topicId: "geometry",
        pKnown: 0.8,
        mastery: 80,
        attempts: 4,
        correct: 4,
        incorrect: 0,
        lastSeen: now - 1000,
        sm2State: { ...DEFAULT_SM2, interval: 3, reps: 2, prevReview: now },
        eloState: { ...DEFAULT_ELO, rating: 1200, lastUpdate: now },
        misconceptionHits: [
          { id: "angle-right-vs-acute", count: 1, lastSeen: now + 10 },
        ],
      },
    ],
    stuckStreakBySkill: { "fractions-concepts": 2 },
    preferredRepBySkill: { "fractions-concepts": "bar_model" },
    updatedAt: now,
  };
}

describe("pedagogy-loop (Report-v3 R2)", () => {
  it("prioritizes misconception hits on weak skills over newer strong-skill hits", () => {
    const { hits, weakSkills, focusSkillId } = prioritizeMisconceptionHits(
      memWeakFrac(),
    );
    expect(weakSkills[0]?.id).toBe("fractions-concepts");
    expect(focusSkillId).toBe("fractions-concepts");
    expect(hits[0]?.id).toBe("frac-add-denom");
    expect(hits.some((h) => h.id === "angle-right-vs-acute")).toBe(true);
  });

  it("activates closed loop when weak + mc + stuck≥2", () => {
    const plan = planPedagogyLoop(memWeakFrac());
    expect(plan.closedLoopActive).toBe(true);
    expect(plan.forced?.skillId).toBe("fractions-concepts");
    expect(plan.forced?.rep).toBe("number_line");
  });

  it("injects closed-loop + misconception hint + forced rep into tutor prompt", () => {
    const p = buildTutorPrompt({
      userText: "还是不懂",
      imageCount: 0,
      voiceId: "auto",
      learningMemory: memWeakFrac(),
    });
    expect(p).toMatch(/Pedagogy closed loop/);
    expect(p).toMatch(/Closed loop ACTIVE/);
    expect(p).toMatch(/Adding across denominators|same-denominator/i);
    expect(p).toMatch(/number_line|Forced multi-rep/i);
    expect(p).toMatch(
      new RegExp(`${Math.round(WEAK_PKNOWN_THRESHOLD * 100)}%`),
    );
  });

  it("bumps stuck streak then forces a new representation on second stuck", () => {
    expect(looksLikeStillStuck("I still don't get it")).toBe(true);
    let mem = emptyLearningMemory();
    const now = Date.now();
    mem = {
      ...mem,
      skills: [
        {
          id: "fractions-concepts",
          label: "fractions concepts",
          topicId: "fractions",
          pKnown: 0.35,
          mastery: 35,
          attempts: 2,
          correct: 0,
          incorrect: 2,
          lastSeen: now,
          sm2State: { ...DEFAULT_SM2 },
          eloState: { ...DEFAULT_ELO, lastUpdate: now },
        },
      ],
      updatedAt: now,
    };
    mem = recordLearningTurnMemory(mem, {
      userText: "I still don't get it with fractions concepts",
      assistantText: "Try a different way",
    });
    expect(mem.stuckStreakBySkill?.["fractions-concepts"]).toBeGreaterThanOrEqual(1);
    mem = recordLearningTurnMemory(mem, {
      userText: "I still don't get it — fractions concepts again",
      assistantText: "Ok another representation",
    });
    expect(mem.stuckStreakBySkill?.["fractions-concepts"]).toBeGreaterThanOrEqual(2);
    const plan = planPedagogyLoop(mem);
    expect(plan.forced).not.toBeNull();
    expect(plan.forced?.skillId).toBe("fractions-concepts");
  });
});
