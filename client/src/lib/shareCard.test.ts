import { describe, expect, it } from "vitest";
import { formatShareScore, wrapShareText } from "./shareCard";

describe("share card helpers", () => {
  it("formats the displayed score without changing its value", () => {
    expect(formatShareScore(8.7)).toBe("8.7/10");
  });

  it("wraps long verdicts into a bounded number of readable lines", () => {
    const lines = wrapShareText("A very considered layered look with strong color balance and an easy silhouette.", 24, 2);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length <= 24)).toBe(true);
    expect(lines.at(-1)).toMatch(/…$/);
  });
});
