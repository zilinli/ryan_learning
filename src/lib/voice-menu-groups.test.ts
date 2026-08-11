import { describe, expect, it } from "vitest";
import { TUTOR_VOICES } from "./voices";
import { CORE_VOICE_IDS, moreVoiceIds, isCoreVoiceId } from "./voice-menu-groups";

describe("voice-menu-groups", () => {
  it("VG1: core ∪ more covers every tutor voice exactly once", () => {
    const more = moreVoiceIds();
    const all = [...CORE_VOICE_IDS, ...more];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(TUTOR_VOICES.map((v) => v.id).sort());
  });

  it("VG2: dialects live in More, not Core", () => {
    expect(isCoreVoiceId("teochew")).toBe(false);
    expect(isCoreVoiceId("hakka")).toBe(false);
    expect(isCoreVoiceId("shanghainese")).toBe(false);
    expect(moreVoiceIds()).toEqual(
      expect.arrayContaining(["teochew", "hakka", "shanghainese", "osman"]),
    );
  });

  it("VG3: yue/en/zh defaults are Core", () => {
    expect(CORE_VOICE_IDS).toEqual(
      expect.arrayContaining(["auto", "wanLung", "ryan", "yunxi"]),
    );
  });
});
