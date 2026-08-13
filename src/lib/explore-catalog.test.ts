import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  buildExploreKickoffMessage,
  getExploreTopic,
  leadingInterestForTopic,
  pickExploreTopics,
  planOneExploreTopic,
  planExploreSequence,
} from "./explore-catalog";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import type { InterestRecord } from "./interest-store";

afterEach(() => {
  kvClearMemory();
});

function memWithSkills(skillIds: string[]): LearningMemory {
  return normalizeMemory({
    skills: skillIds.map((id) => ({
      id,
      label: id,
      topicId: "test",
      pKnown: 0.5,
      mastery: 50,
      attempts: 1,
      correct: 0,
      incorrect: 0,
      lastSeen: Date.now(),
      sm2State: { ef: 2.5, interval: 2, reps: 1, prevReview: Date.now() },
      eloState: { rating: 1200, n: 1, lastUpdate: Date.now() },
    })),
    updatedAt: Date.now(),
  });
}

function interest(
  topicId: string,
  label: string,
  opts: { count?: number; exploredAt?: number } = {},
): InterestRecord {
  return {
    topicId,
    label,
    emoji: "✨",
    exploredAt: opts.exploredAt ?? Date.now(),
    count: opts.count ?? 1,
  };
}

const NOW = Date.now();
const A_WEEK_AGO = NOW - 8 * 24 * 60 * 60 * 1000;

describe("explore-catalog: pickExploreTopics", () => {
  it("without interests, skill overlap still wins", () => {
    const mem = memWithSkills(["earth-moon-sun", "physics-6-8", "scientific-method"]);
    const picks = pickExploreTopics(mem, 4, []);
    expect(picks[0].id).toBe("space");
  });

  it("a favorite interest gets a count-weighted boost and stays visible", () => {
    const picks = pickExploreTopics(null, 4, [
      interest("magic", "Magic & number tricks", { count: 5 }),
    ]);
    expect(picks.map((p) => p.id)).toContain("magic");
    // count boost (min 3) lifts it above all untouched topics
    expect(picks[0].id).toBe("magic");
  });

  it("recent interests boost derivative (neighbor) topics", () => {
    const picks = pickExploreTopics(null, 8, [
      interest("dinosaurs", "Dinosaurs & fossils"),
    ]);
    const ids = picks.map((p) => p.id);
    expect(ids[0]).toBe("dinosaurs");
    // animals & oceans share skills with dinosaurs → both boosted ahead of
    // untouched topics (their mutual order is a stable-sort artifact).
    expect([ids[1], ids[2]].sort()).toEqual(["animals", "oceans"]);
    expect(ids.slice(3)).not.toContain("animals");
  });

  it("an old interest no longer drives the derivative boost", () => {
    const picks = pickExploreTopics(null, 8, [
      interest("dinosaurs", "Dinosaurs & fossils", { exploredAt: A_WEEK_AGO }),
    ]);
    const ids = picks.map((p) => p.id);
    // dinosaurs itself still ranks (own boost), but neighbors are not boosted
    expect(ids[0]).toBe("dinosaurs");
    expect(ids[1]).not.toBe("animals");
  });
});

describe("explore-catalog: leading interest + continuation copy", () => {
  it("finds the recent interest that this topic continues", () => {
    const dino = interest("dinosaurs", "Dinosaurs & fossils");
    const animals = getExploreTopic("animals")!;
    const lead = leadingInterestForTopic(animals, [dino]);
    expect(lead?.topicId).toBe("dinosaurs");
  });

  it("kickoff mentions the neighbor continuation", () => {
    const kickoff = buildExploreKickoffMessage(
      getExploreTopic("animals")!,
      null,
      [interest("dinosaurs", "Dinosaurs & fossils")],
    );
    expect(kickoff).toContain("its neighbor");
    expect(kickoff).toContain("Dinosaurs & fossils");
  });

  it("kickoff without a leading interest omits continuation copy", () => {
    const kickoff = buildExploreKickoffMessage(
      getExploreTopic("space")!,
      null,
      [],
    );
    expect(kickoff).not.toContain("its neighbor");
    expect(kickoff).toContain("Space & planets");
    // V2 P2 — curiosity hook is always present (report §9.1.2)
    expect(kickoff).toContain("counterintuitive fact or unsolved mystery");
  });
});

describe("explore-catalog: planExploreSequence (V2 P2 §9.3.3)", () => {
  it("plans a topic and a ZPD start skill without calling the LLM", () => {
    const now = Date.now();
    const mem = normalizeMemory({
      skills: [
        // music's first skill mid-band → the ZPD start for "music"
        {
          id: "fractions-concepts",
          label: "fraction concepts",
          topicId: "fractions",
          pKnown: 0.5,
          mastery: 50,
          attempts: 4,
          correct: 2,
          incorrect: 2,
          lastSeen: now,
          sm2State: { ef: 2.5, interval: 2, reps: 2, prevReview: now },
          eloState: { rating: 1300, n: 4, lastUpdate: now },
        },
        // known anchor skill outside the topic
        {
          id: "multiplication-facts",
          label: "multiplication facts",
          topicId: "multiplication",
          pKnown: 0.9,
          mastery: 90,
          attempts: 8,
          correct: 7,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.5, interval: 5, reps: 4, prevReview: now },
          eloState: { rating: 1600, n: 8, lastUpdate: now },
        },
      ],
      updatedAt: now,
    });
    const plan = planOneExploreTopic(getExploreTopic("music")!, mem, []);
    expect(plan.zpdSkill).toBe("fraction concepts");
    expect(plan.anchorSkills).toContain("multiplication facts");
    expect(plan.kickoff).toContain("fraction concepts");
    expect(plan.kickoff).toContain("right at the edge of what I know");
    expect(plan.topic.id).toBe("music");
  });

  it("no mid-band skill → zpdSkill is null but plan still builds", () => {
    const plan = planOneExploreTopic(getExploreTopic("space")!, null, []);
    expect(plan.zpdSkill).toBeNull();
    expect(plan.kickoff.length).toBeGreaterThan(30);
  });

  it("plans a whole sequence (topic list + kickoffs)", () => {
    const plans = planExploreSequence(null, [], 4);
    expect(plans).toHaveLength(4);
    for (const p of plans) {
      expect(p.kickoff).toContain(p.topic.label);
    }
    // de-duplicated topic ids
    const ids = new Set(plans.map((p) => p.topic.id));
    expect(ids.size).toBe(4);
  });
});
