import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprintImageBytes } from "./imageFingerprint";
import { normalizeResult, type FitCheckResult } from "./fitcheck";

const baseResult: FitCheckResult = {
  overall_score: 0,
  confidence: 0.9,
  image_quality: "good",
  coverage: { visible_categories: ["outfit", "color", "fit", "shoes", "styling"], unavailable_categories: [] },
  scores: {
    outfit: { score: 7.8, visibility: "visible", reason: "cohesion" },
    color: { score: 7.2, visibility: "visible", reason: "harmony" },
    fit: { score: 8.1, visibility: "visible", reason: "silhouette" },
    shoes: { score: 6.9, visibility: "visible", reason: "footwear" },
    styling: { score: 7.5, visibility: "visible", reason: "details" },
    occasion_suitability: { score: 8.0, visibility: "visible", reason: "occasion" },
  },
  verdict: "Balanced casual fit.",
  strengths: ["Clear color direction"],
  improvements: ["Refine the finishing details"],
  summary: "A consistent casual outfit with a clear visual direction.",
};

describe("deterministic image analysis foundations", () => {
  it("returns the same SHA-256 fingerprint for identical bytes", () => {
    const first = new Uint8Array([1, 2, 3, 4, 5]);
    const second = new Uint8Array([1, 2, 3, 4, 5]);
    expect(fingerprintImageBytes(first)).toBe(fingerprintImageBytes(second));
    expect(fingerprintImageBytes(first)).not.toBe(fingerprintImageBytes(new Uint8Array([1, 2, 3, 4, 6])));
  });

  it("keeps real normalized outfit payloads repeatable and separates different outfit images", () => {
    const outfitA = readFileSync(resolve(import.meta.dirname, "fixtures/outfit-a.jpg"));
    const outfitB = readFileSync(resolve(import.meta.dirname, "fixtures/outfit-b.jpg"));
    expect(fingerprintImageBytes(outfitA)).toBe(fingerprintImageBytes(Uint8Array.from(outfitA)));
    expect(fingerprintImageBytes(outfitA)).not.toBe(fingerprintImageBytes(outfitB));
  });

  it("derives the same rounded weighted score from the same structured categories", () => {
    const first = normalizeResult(baseResult);
    const second = normalizeResult({ ...baseResult, overall_score: 9.9 });
    expect(first.overall_score).toBe(7.7);
    expect(second.overall_score).toBe(first.overall_score);
  });
});
