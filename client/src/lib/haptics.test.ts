import { describe, expect, it } from "vitest";
import { hapticPattern, triggerHaptic } from "./haptics";

describe("optional haptics", () => {
  it("uses light feedback for ordinary important interactions and stronger feedback for milestones", () => {
    expect(hapticPattern("light")).toBe(8);
    expect(hapticPattern("medium")).toBe(18);
    expect(hapticPattern("success")).toEqual([18, 12, 28]);
  });

  it("falls back silently when vibration is unavailable", () => {
    expect(triggerHaptic("light")).toBe(false);
  });
});
