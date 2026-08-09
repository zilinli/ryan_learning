import { describe, expect, it } from "vitest";
import {
  formatProgressLabel,
  formatProgressLabelOrDone,
  isWorksheetComplete,
  mergeWorksheetPlan,
  parseWorksheetPlanFence,
  planFromJson,
  stripWorksheetPlanFence,
} from "./worksheet-planner";

const sample = {
  total: 8,
  current: 1,
  items: [
    { id: 1, label: "Q1", status: "active" },
    { id: 2, label: "Q2", status: "pending" },
  ],
};

describe("worksheet-planner (CA-1)", () => {
  it("WP1: valid fence parses total/current/items", () => {
    const text = `Look at Q1.\n\n~~~worksheet-plan\n${JSON.stringify(sample)}\n~~~\n\nWhat do you notice?`;
    const plan = parseWorksheetPlanFence(text, 1000);
    expect(plan).not.toBeNull();
    expect(plan!.total).toBe(8);
    expect(plan!.current).toBe(1);
    expect(plan!.items).toHaveLength(2);
    expect(plan!.items[0]!.status).toBe("active");
    expect(plan!.updatedAt).toBe(1000);
  });

  it("WP2: invalid JSON / missing fields → null", () => {
    expect(parseWorksheetPlanFence("~~~worksheet-plan\n{not json}\n~~~")).toBeNull();
    expect(planFromJson({ total: 3, current: 1 })).toBeNull();
    expect(planFromJson({ items: [] })).toBeNull();
  });

  it("WP3: strip removes fence; prose kept", () => {
    const text = `Hello.\n~~~worksheet-plan\n${JSON.stringify(sample)}\n~~~\nWorld.`;
    const stripped = stripWorksheetPlanFence(text);
    expect(stripped).toContain("Hello.");
    expect(stripped).toContain("World.");
    expect(stripped).not.toContain("worksheet-plan");
  });

  it("WP4: multiple fences → last wins", () => {
    const first = { ...sample, current: 1 };
    const second = {
      total: 8,
      current: 2,
      items: [
        { id: 1, label: "Q1", status: "done" },
        { id: 2, label: "Q2", status: "active" },
      ],
    };
    const text = `~~~worksheet-plan\n${JSON.stringify(first)}\n~~~\n~~~worksheet-plan\n${JSON.stringify(second)}\n~~~`;
    const plan = parseWorksheetPlanFence(text);
    expect(plan!.current).toBe(2);
    expect(plan!.items[1]!.status).toBe("active");
  });

  it("WP5: formatProgressLabel", () => {
    expect(formatProgressLabel({ current: 2, total: 8 })).toBe("Question 2 of 8");
  });

  it("WP6: merge prefers newer updatedAt", () => {
    const a = planFromJson(sample, 10)!;
    const advanced = {
      total: 8,
      current: 3,
      items: [
        { id: 1, label: "Q1", status: "done" },
        { id: 2, label: "Q2", status: "done" },
        { id: 3, label: "Q3", status: "active" },
      ],
    };
    const b = planFromJson(advanced, 20)!;
    expect(b.current).toBe(3);
    expect(mergeWorksheetPlan(a, b)!.current).toBe(3);
    expect(mergeWorksheetPlan(b, a)!.current).toBe(3);
  });

  it("WP7: unknown status normalized then current marked active", () => {
    const plan = planFromJson({
      total: 2,
      current: 1,
      items: [
        { id: 1, label: "Q1", status: "weird" },
        { id: 2, label: "Q2", status: "pending" },
      ],
    })!;
    // "weird" → pending, then no active → id===current becomes active
    expect(plan.items[0]!.status).toBe("active");
    expect(plan.items[1]!.status).toBe("pending");
  });

  it("WP8: empty items rejected; total clamped to items length min", () => {
    expect(planFromJson({ total: 5, items: [{ id: 0, label: "x" }] })).toBeNull();
    const plan = planFromJson({
      total: 2,
      current: 9,
      items: [{ id: 1, label: "A" }],
    })!;
    expect(plan.total).toBeGreaterThanOrEqual(1);
    expect(plan.current).toBeLessThanOrEqual(plan.total);
  });

  it("WP9: isWorksheetComplete when all items done/skipped", () => {
    const done = planFromJson(
      {
        total: 2,
        current: 2,
        items: [
          { id: 1, label: "Q1", status: "done" },
          { id: 2, label: "Q2", status: "skipped" },
        ],
      },
      1,
    )!;
    expect(isWorksheetComplete(done)).toBe(true);
    expect(formatProgressLabelOrDone(done)).toBe("All done · 2 questions");
    expect(isWorksheetComplete(planFromJson(sample, 1))).toBe(false);
  });
});
