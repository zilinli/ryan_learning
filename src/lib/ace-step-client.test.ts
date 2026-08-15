import { describe, expect, it } from "vitest";
import { isAceStepConfigured } from "./ace-step-client";

describe("ace-step-client", () => {
  it("reports unconfigured when ACE_STEP_BASE_URL unset", () => {
    const prev = process.env.ACE_STEP_BASE_URL;
    delete process.env.ACE_STEP_BASE_URL;
    expect(isAceStepConfigured()).toBe(false);
    if (prev !== undefined) process.env.ACE_STEP_BASE_URL = prev;
  });
});
