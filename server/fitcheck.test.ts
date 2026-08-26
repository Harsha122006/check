import { describe, expect, it } from "vitest";
import { normalizeResult } from "./fitcheck";

const base = {
  overall_score: 9.9,
  scores: { outfit: 9, color: 8, fit: 7, shoes: 6, styling: 5 },
  verdict: "Strong balance.",
  strengths: ["Clear color story"],
  improvements: ["Try a cleaner shoe"],
  summary: "The outfit has a clear, visible direction.",
  confidence: 0.9,
};

describe("FitCheck result normalization", () => {
  it("calculates the overall score from the fixed category weighting", () => {
    const result = normalizeResult(base);
    expect(result.overall_score).toBe(7.3);
  });

  it("prevents low-confidence photos from receiving an invented score", () => {
    const result = normalizeResult({ ...base, confidence: 0.2 });
    expect(result.overall_score).toBe(0);
    expect(result.verdict).toBe("Can’t judge this fit reliably.");
    expect(result.improvements[0]).toContain("brighter full-body photo");
  });
});

import { analyzeFitWithGemini } from "./fitcheck";

describe("FitCheck image validation", () => {
  it("rejects non-image payloads before contacting Gemini", async () => {
    await expect(analyzeFitWithGemini({ imageDataUrl: "not-an-image" })).rejects.toThrow("INVALID_IMAGE_DATA");
  });
});
