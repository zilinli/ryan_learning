import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  addWrongAnswer,
  buildVariantKickoffMessage,
  buildVariantKickoffOpener,
  buildWrongAnswerReviewSet,
  buildWrongReviewKickoffMessage,
  buildWrongReviewOpener,
  consumeVariantKickoff,
  consumeWrongReviewKickoff,
  deleteWrongAnswer,
  loadWrongAnswers,
  skillLabelForText,
  stashVariantKickoff,
  stashWrongReviewKickoff,
  wrongAnswersBySkill,
  wrongAnswerStorageKey,
} from "./wrong-answer-store";

const ACCT = "acct_wrong";

afterEach(() => {
  kvClearMemory();
});

function add(q: string, skillId = "fractions-concepts", label = "Fraction concepts", when = Date.now() - 1000) {
  return addWrongAnswer(ACCT, {
    skillId,
    skillLabel: label,
    question: q,
    studentAnswer: "my answer",
    assistantText: "Not quite — let's look again",
    createdAt: when,
  });
}

describe("wrong-answer-store", () => {
  it("adds and loads wrong answers newest-first", () => {
    add("Q old", "a", "A", 1000);
    add("Q new", "b", "B", 2000);
    const items = loadWrongAnswers(ACCT);
    expect(items).toHaveLength(2);
    expect(items[0]?.question).toBe("Q new");
    expect(items[0]?.skillLabel).toBe("B");
  });

  it("groups by skill, most common first", () => {
    add("q1", "fractions-concepts", "Fraction concepts");
    add("q2", "fractions-concepts", "Fraction concepts");
    add("q3", "algebra-equations", "Algebra equations");
    const groups = wrongAnswersBySkill(ACCT);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.skillId).toBe("fractions-concepts");
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("deletes a single wrong answer", () => {
    const w = add("q1", "fractions-concepts", "Fraction concepts");
    expect(deleteWrongAnswer(ACCT, w.id)).toBe(true);
    expect(loadWrongAnswers(ACCT)).toHaveLength(0);
    expect(deleteWrongAnswer(ACCT, "nope")).toBe(false);
  });

  it("builds a review set of recent answers", () => {
    add("q1", "fractions-concepts", "Fraction concepts", 1000);
    add("q2", "fractions-concepts", "Fraction concepts", 2000);
    add("q3", "fractions-concepts", "Fraction concepts", 3000);
    add("q4", "fractions-concepts", "Fraction concepts", 4000);
    const set = buildWrongAnswerReviewSet(ACCT, 3);
    expect(set.map((w) => w.question)).toEqual(["q4", "q3", "q2"]);
  });

  it("stashes and consumes a review kickoff", () => {
    const items = [
      addWrongAnswer(ACCT, { skillId: "s", skillLabel: "S", question: "Q?", studentAnswer: "a", assistantText: "t" }),
    ];
    stashWrongReviewKickoff(items);
    const consumed = consumeWrongReviewKickoff();
    expect(consumed?.[0]?.question).toBe("Q?");
    expect(consumeWrongReviewKickoff()).toBeNull();
  });

  it("builds a kickoff message with the questions", () => {
    const msg = buildWrongReviewKickoffMessage([
      { id: "a", accountId: ACCT, skillId: "s", skillLabel: "Fractions", question: "What is 1/2 + 1/4?", studentAnswer: "", assistantText: "", createdAt: 1 },
    ]);
    expect(msg).toMatch(/1\/2 \+ 1\/4/);
    expect(msg).toMatch(/one at a time/i);
  });

  it("wrong-review opener carries a kickoff override", () => {
    const opener = buildWrongReviewOpener([
      { id: "a", accountId: ACCT, skillId: "s", skillLabel: "Fractions", question: "Q?", studentAnswer: "", assistantText: "", createdAt: 1 },
    ]);
    expect(opener.kind).toBe("practice");
    expect(opener.kickoffOverride).toMatch(/Let's redo/);
  });

  it("skillLabelForText infers a skill or falls back to general", () => {
    const hit = skillLabelForText("fractions 1/2 + 1/4");
    expect(hit.skillId.length).toBeGreaterThan(0);
    expect(skillLabelForText("hello world")).toEqual({ skillId: "general", skillLabel: "General practice" });
  });

  it("storage key is namespaced per account", () => {
    expect(wrongAnswerStorageKey("a")).not.toBe(wrongAnswerStorageKey("b"));
  });

  describe("variant / harder path (P1 §9.3.2)", () => {
    function wa() {
      return addWrongAnswer(ACCT, {
        skillId: "fractions-concepts",
        skillLabel: "Fraction concepts",
        question: "What is 1/2 + 1/4?",
        studentAnswer: "2/3",
        assistantText: "Not quite",
      });
    }

    it("variant kickoff re-tests the same skill with new numbers", () => {
      const msg = buildVariantKickoffMessage(wa(), "variant");
      expect(msg).toMatch(/VARIANT/);
      expect(msg).toMatch(/different numbers/);
      expect(msg).toMatch(/no spoilers/);
    });

    it("harder kickoff lifts the skill half a level", () => {
      const msg = buildVariantKickoffMessage(wa(), "harder");
      expect(msg).toMatch(/lift it UP half a level/);
      expect(msg).toMatch(/new context/);
    });

    it("stash/consume variant kickoff is one-shot and round-trips", () => {
      const w = wa();
      stashVariantKickoff(w, "harder");
      const k = consumeVariantKickoff();
      expect(k?.action).toBe("harder");
      expect(k?.skillId).toBe("fractions-concepts");
      expect(k?.question).toMatch(/1\/2 \+ 1\/4/);
      expect(consumeVariantKickoff()).toBeNull();
    });

    it("variant opener carries a kickoff override", () => {
      const w = wa();
      stashVariantKickoff(w, "variant");
      const k = consumeVariantKickoff()!;
      const opener = buildVariantKickoffOpener(k);
      expect(opener.kind).toBe("practice");
      expect(opener.kickoffOverride).toMatch(/VARIANT/);
    });
  });
});
