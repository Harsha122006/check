import { describe, expect, it } from "vitest";
import { analyzeFitWithGemini, classifyGeminiError, FitCheckError, getImageDimensions, isRetryableGeminiError, normalizeResult, parseFitCheckResponse, parseWithRecovery, toPublicAnalysisError, validateImageDataUrl } from "./fitcheck";
import { isCurrentAnalysisRequest, shouldStartAnalysis } from "../client/src/lib/analysisGuards";

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

describe("FitCheck Gemini error policy", () => {
  it("retries only temporary transport and API failures", () => {
    expect(isRetryableGeminiError({ status: 429 })).toBe(true);
    expect(isRetryableGeminiError({ status: 503 })).toBe(true);
    expect(isRetryableGeminiError(new TypeError("network failed"))).toBe(true);
    expect(isRetryableGeminiError({ status: 400 })).toBe(false);
    expect(isRetryableGeminiError({ status: 401 })).toBe(false);
  });

  it("maps API failures to safe public error categories", () => {
    expect(classifyGeminiError({ status: 429 })).toBe("RATE_LIMIT");
    expect(classifyGeminiError({ status: 503 })).toBe("SERVER_ERROR");
    expect(classifyGeminiError({ status: 401 })).toBe("INVALID_API_KEY");
    expect(classifyGeminiError({ status: 400 })).toBe("INVALID_REQUEST");
  });
});

describe("FitCheck image validation", () => {
  it("accepts supported JPEG, PNG, and WebP data URLs", () => {
    expect(validateImageDataUrl("data:image/jpeg;base64,AAAA").mimeType).toBe("image/jpeg");
    expect(validateImageDataUrl("data:image/png;base64,AAAA").mimeType).toBe("image/png");
    expect(validateImageDataUrl("data:image/webp;base64,AAAA").mimeType).toBe("image/webp");
  });

  it("reads PNG dimensions without making dimensions a hard failure", () => {
    const png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    expect(getImageDimensions("image/png", png1x1)).toEqual({ width: 1, height: 1 });
  });

  it("reads JPEG SOF dimensions deterministically", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x01, 0x2c, 0x02, 0x00, 0x03, 0x01, 0x11, 0x00, 0xff, 0xd9]).toString("base64");
    expect(getImageDimensions("image/jpeg", jpeg)).toEqual({ width: 512, height: 300 });
  });

  it("reads WebP VP8X dimensions deterministically", () => {
    const webp = Buffer.alloc(31);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");
    webp.write("VP8X", 12, "ascii");
    webp[24] = 99; webp[25] = 0; webp[26] = 0;
    webp[27] = 49; webp[28] = 0; webp[29] = 0;
    expect(getImageDimensions("image/webp", webp.toString("base64"))).toEqual({ width: 100, height: 50 });
  });

  it("rejects non-image and oversized payloads before contacting Gemini", async () => {
    await expect(analyzeFitWithGemini({ imageDataUrl: "not-an-image" })).rejects.toMatchObject({ code: "IMAGE_PROBLEM" } satisfies Partial<FitCheckError>);
    await expect(analyzeFitWithGemini({ imageDataUrl: `data:image/jpeg;base64,${"A".repeat(750_001)}` })).rejects.toMatchObject({ code: "IMAGE_PROBLEM" } satisfies Partial<FitCheckError>);
  });
});

describe("FitCheck structured response parsing", () => {
  it("rejects malformed JSON with the safe response error", () => {
    expect(() => parseFitCheckResponse("{bad json")).toThrowError("The fit read came back incomplete.");
  });

  it("recovers once from malformed JSON and parses the next response", () => {
    expect(parseWithRecovery(["{bad json", JSON.stringify(base)]).overall_score).toBe(9.9);
  });

  it("stops recovery after two malformed responses", () => {
    expect(() => parseWithRecovery(["{bad json", "still bad", JSON.stringify(base)])).toThrowError(FitCheckError);
  });
});

describe("FitCheck request safety guards", () => {
  it("suppresses duplicate submissions while pending or analyzing", () => {
    expect(shouldStartAnalysis(false, "preview")).toBe(true);
    expect(shouldStartAnalysis(true, "preview")).toBe(false);
    expect(shouldStartAnalysis(false, "analyzing")).toBe(false);
  });

  it("ignores stale responses after a newer request becomes active", () => {
    expect(isCurrentAnalysisRequest(7, 7)).toBe(true);
    expect(isCurrentAnalysisRequest(8, 7)).toBe(false);
  });

  it("maps internal timeout and cancellation states to safe public errors", () => {
    expect(toPublicAnalysisError(new Error("aborted"), true, false).code).toBe("API_TIMEOUT");
    expect(toPublicAnalysisError(new Error("aborted"), false, true).code).toBe("REQUEST_CANCELLED");
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
