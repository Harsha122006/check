import { describe, expect, it } from "vitest";

describe("Gemini configuration", () => {
  it("accepts the configured server-side API key", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be configured for this test").toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`);
    expect(response.ok, `Gemini credential check failed with HTTP ${response.status}`).toBe(true);
  }, 15_000);
});
