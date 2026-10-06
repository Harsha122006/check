import { describe, expect, it } from "vitest";
import { formatShareScore, formatShareUsername, imageSourceNeedsEmbedding, wrapShareText } from "./shareCard";

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

  it("embeds remote and blob photos while leaving existing data URLs untouched", () => {
    expect(imageSourceNeedsEmbedding("/manus-storage/outfit.jpg")).toBe(true);
    expect(imageSourceNeedsEmbedding("blob:https://fitcheck.test/photo")).toBe(true);
    expect(imageSourceNeedsEmbedding("data:image/jpeg;base64,abc")).toBe(false);
  });

  it("turns a display name into the compact share-card handle", () => {
    expect(formatShareUsername("Virat Kohli")).toBe("viratkohli");
    expect(formatShareUsername("viratkohli")).toBe("viratkohli");
    expect(formatShareUsername(undefined)).toBe("");
  });
});
