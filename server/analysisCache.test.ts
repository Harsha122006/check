import { describe, expect, it } from "vitest";
import { buildAnalysisCacheKey, trimAnalysisCache } from "./analysisCache";
import { OCCASION_CRITERIA } from "./fitcheck";

describe("occasion-aware analysis cache", () => {
  it("provides criteria for every supported occasion", () => {
    expect(Object.keys(OCCASION_CRITERIA)).toEqual([
      "Casual",
      "Formal",
      "College",
      "Party",
      "Date",
      "Streetwear",
      "Other",
    ]);
    expect(Object.values(OCCASION_CRITERIA).every(value => value.length > 20)).toBe(true);
  });

  it("separates exact-image analysis by occasion", () => {
    const fingerprint = "same-image";
    expect(buildAnalysisCacheKey(fingerprint, "Casual")).not.toBe(buildAnalysisCacheKey(fingerprint, "Formal"));
    expect(buildAnalysisCacheKey(fingerprint, "Casual")).toBe(buildAnalysisCacheKey(fingerprint, "Casual"));
  });

  it("evicts the oldest entries when the bounded cache is over limit", () => {
    const cache = new Map([["a", 1], ["b", 2], ["c", 3]]);
    trimAnalysisCache(cache, 2);
    expect([...cache.keys()]).toEqual(["b", "c"]);
  });
});

