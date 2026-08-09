import { describe, expect, it } from "vitest";
import {
  formatProgressLabel,
  formatProgressLabelOrDone,
  isWorksheetComplete,
  planFromJson,
} from "./worksheet-planner";
import type { ConversationRecord } from "./types";

describe("worksheet mid-exit (A1.h.6)", () => {
  it("persisted ConversationRecord keeps Question N of T after remount data", () => {
    const plan = planFromJson(
      {
        total: 8,
        current: 6,
        items: [
          { id: 1, label: "Q1", status: "done" },
          { id: 2, label: "Q2", status: "done" },
          { id: 3, label: "Q3", status: "done" },
          { id: 4, label: "Q4", status: "done" },
          { id: 5, label: "Q5", status: "done" },
          { id: 6, label: "Q6", status: "active" },
          { id: 7, label: "Q7", status: "pending" },
          { id: 8, label: "Q8", status: "pending" },
        ],
      },
      1000,
    )!;

    // Simulate save → load → remount (tab switch): plan lives on ConversationRecord
    const saved: ConversationRecord = {
      sessionId: "s_mid",
      title: "Homework",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "photo",
          createdAt: 1,
        },
      ],
      createdAt: 1,
      updatedAt: 2,
      worksheetPlan: plan,
    };
    const remounted = JSON.parse(JSON.stringify(saved)) as ConversationRecord;
    expect(remounted.worksheetPlan?.current).toBe(6);
    expect(remounted.worksheetPlan?.total).toBe(8);
    expect(formatProgressLabel(remounted.worksheetPlan!)).toBe(
      "Question 6 of 8",
    );
    expect(isWorksheetComplete(remounted.worksheetPlan)).toBe(false);
    expect(formatProgressLabelOrDone(remounted.worksheetPlan!)).toBe(
      "Question 6 of 8",
    );
  });
});
