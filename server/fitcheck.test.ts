import { describe, expect, it } from "vitest";
import { analyzeFitWithGemini, normalizeResult } from "./fitcheck";

const category = (score: number | null, visibility: "visible" | "not_visible" | "unclear" = "visible", reason = "Visible clothing evidence.") => ({ score, visibility, reason });

const base = {
  overall_score: 9.9,
  confidence: 0.9,
  image_quality: "good" as const,
  coverage: { visible_categories: ["outfit", "color", "fit", "shoes", "styling"] as const, unavailable_categories: [] as const },
  scores: {
    outfit: category(9),
    color: category(8),
    fit: category(7),
    shoes: category(6),
    styling: category(5),
  },
  verdict: "Strong balance.",
  strengths: ["Clear color story"],
  improvements: ["Try a cleaner shoe"],
  summary: "The outfit has a clear, visible direction.",
};

describe("FitCheck result normalization", () => {
  it("calculates the overall score from fixed weights when every category is visible", () => {
    const result = normalizeResult(base);
    expect(result.overall_score).toBe(7.3);
  });

  it("renormalizes weights when shoes are not visible instead of treating them as zero", () => {
    const result = normalizeResult({
      ...base,
      coverage: { visible_categories: ["outfit", "color", "fit", "styling"], unavailable_categories: ["shoes"] },
      scores: { ...base.scores, shoes: category(null, "not_visible", "Shoes are outside the image frame.") },
    });
    expect(result.overall_score).toBe(7.6);
    expect(result.scores.shoes.score).toBeNull();
    expect(result.coverage.unavailable_categories).toContain("shoes");
  });

  it("keeps usable upper-body photos scorable with unavailable categories marked not_visible", () => {
    const result = normalizeResult({
      ...base,
      image_quality: "usable",
      confidence: 0.68,
      coverage: { visible_categories: ["outfit", "color", "styling"], unavailable_categories: ["fit", "shoes"] },
      scores: { ...base.scores, fit: category(null, "not_visible", "Lower-body proportions are outside the frame."), shoes: category(null, "not_visible", "Shoes are outside the image frame.") },
    });
    expect(result.overall_score).toBe(7.8);
    expect(result.overall_score).toBeGreaterThan(0);
    expect(result.scores.fit.score).toBeNull();
    expect(result.scores.shoes.score).toBeNull();
  });

  it("rejects only genuinely insufficient images", () => {
    const result = normalizeResult({
      ...base,
      image_quality: "insufficient",
      confidence: 0.2,
      coverage: { visible_categories: [], unavailable_categories: ["outfit", "color", "fit", "shoes", "styling"] },
      scores: { outfit: category(null, "not_visible", "No clothing is visible."), color: category(null, "not_visible", "No clothing is visible."), fit: category(null, "not_visible", "No clothing is visible."), shoes: category(null, "not_visible", "No clothing is visible."), styling: category(null, "not_visible", "No clothing is visible.") },
    });
    expect(result.overall_score).toBe(0);
    expect(result.verdict).toBe("Can’t judge this fit reliably.");
    expect(result.improvements[0]).toContain("brighter photo");
  });
});

describe("FitCheck image validation", () => {
  it("rejects non-image payloads before contacting Gemini", async () => {
    await expect(analyzeFitWithGemini({ imageDataUrl: "not-an-image" })).rejects.toThrow("INVALID_IMAGE_DATA");
  });
});


describe("FitCheck quality and honest scoring", () => {
  it("keeps a slightly blurry but usable outfit scorable", () => {
    const result = normalizeResult({ ...base, image_quality: "usable", confidence: 0.62 });
    expect(result.overall_score).toBe(7.3);
    expect(result.overall_score).toBeGreaterThan(0);
  });

  it("returns a clear unusable result for an extremely dark image", () => {
    const result = normalizeResult({
      ...base,
      image_quality: "insufficient",
      confidence: 0.12,
      coverage: { visible_categories: [], unavailable_categories: ["outfit", "color", "fit", "shoes", "styling"] },
      scores: { outfit: category(null, "unclear", "The image is too dark."), color: category(null, "unclear", "The image is too dark."), fit: category(null, "unclear", "The image is too dark."), shoes: category(null, "unclear", "The image is too dark."), styling: category(null, "unclear", "The image is too dark.") },
    });
    expect(result.overall_score).toBe(0);
    expect(result.verdict).toBe("Can’t judge this fit reliably.");
  });

  it("allows genuinely excellent scores without forcing every result above eight", () => {
    const excellent = normalizeResult({ ...base, scores: { outfit: category(9.6), color: category(9.4), fit: category(9.2), shoes: category(9.5), styling: category(9.3) } });
    const weak = normalizeResult({ ...base, scores: { outfit: category(5.2), color: category(4.8), fit: category(5.1), shoes: category(4.5), styling: category(5.4) } });
    expect(excellent.overall_score).toBeGreaterThan(9);
    expect(weak.overall_score).toBeLessThan(6);
  });
});
