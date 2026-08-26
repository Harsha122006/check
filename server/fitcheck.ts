import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const GEMINI_MODEL = "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_IMAGE_DATA_LENGTH = 750_000;
const CATEGORY_KEYS = ["outfit", "color", "fit", "shoes", "styling"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const categoryResultSchema = z.object({
  score: z.number().min(0).max(10).nullable(),
  visibility: z.enum(["visible", "not_visible", "unclear"]),
  reason: z.string().min(1).max(180),
});

export const fitCheckResultSchema = z.object({
  overall_score: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  image_quality: z.enum(["good", "usable", "insufficient"]),
  coverage: z.object({
    visible_categories: z.array(z.enum(CATEGORY_KEYS)).max(5),
    unavailable_categories: z.array(z.enum(CATEGORY_KEYS)).max(5),
  }),
  scores: z.object({
    outfit: categoryResultSchema,
    color: categoryResultSchema,
    fit: categoryResultSchema,
    shoes: categoryResultSchema,
    styling: categoryResultSchema,
  }),
  verdict: z.string().min(1).max(80),
  strengths: z.array(z.string().min(1).max(140)).max(3),
  improvements: z.array(z.string().min(1).max(180)).max(3),
  summary: z.string().min(1).max(600),
});

export type FitCheckResult = z.infer<typeof fitCheckResultSchema>;

const nullableScore = {
  anyOf: [{ type: Type.NUMBER }, { type: Type.NULL }],
  description: "A score from 0 to 10, or null when the category is not visible enough to evaluate.",
};

const categoryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    score: nullableScore,
    visibility: { type: Type.STRING, enum: ["visible", "not_visible", "unclear"] },
    reason: { type: Type.STRING },
  },
  required: ["score", "visibility", "reason"],
};

const fitCheckResponseSchema = {
  type: Type.OBJECT,
  properties: {
    overall_score: { type: Type.NUMBER, description: "Dynamic weighted score from 0 to 10 using only categories with visibility visible. Use 0 only when image_quality is insufficient." },
    confidence: { type: Type.NUMBER, description: "Confidence from 0 to 1. Lower it for crop, blur, obstruction, poor lighting, or missing details, but do not fail a usable partial image." },
    image_quality: { type: Type.STRING, enum: ["good", "usable", "insufficient"] },
    coverage: {
      type: Type.OBJECT,
      properties: {
        visible_categories: { type: Type.ARRAY, items: { type: Type.STRING, enum: CATEGORY_KEYS } },
        unavailable_categories: { type: Type.ARRAY, items: { type: Type.STRING, enum: CATEGORY_KEYS } },
      },
      required: ["visible_categories", "unavailable_categories"],
    },
    scores: {
      type: Type.OBJECT,
      properties: {
        outfit: categoryResponseSchema,
        color: categoryResponseSchema,
        fit: categoryResponseSchema,
        shoes: categoryResponseSchema,
        styling: categoryResponseSchema,
      },
      required: [...CATEGORY_KEYS],
    },
    verdict: { type: Type.STRING, description: "A short honest verdict, maximum 6 words." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to three strengths grounded in visible clothing." },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to three constructive improvements grounded in visible clothing." },
    summary: { type: Type.STRING, description: "A concise summary that mentions unavailable categories when relevant." },
  },
  required: ["overall_score", "confidence", "image_quality", "coverage", "scores", "verdict", "strengths", "improvements", "summary"],
};

const systemInstruction = `You are Fit Check, a sharp but kind AI fashion critic. Judge what you can see, never punish what you cannot.

First make a lightweight image-quality assessment: determine whether a person or clothing is visible, whether the image is too blurry, extremely dark, too small, or mostly obstructed. A cropped head, cropped shoes, upper-body photo, lower-body photo, mirror selfie, awkward framing, or partially out-of-frame outfit is valid when enough clothing is visible. Only use image_quality insufficient when there is genuinely not enough visual information for useful outfit feedback.

Analyze ONLY visible evidence. Never invent or assume shoes, accessories, brands, colors, materials, logos, patterns, garment details, proportions, or fit. If an item or category is outside the frame, set that category score to null, visibility to not_visible, and explain why. If visibility is unclear, use score null and visibility unclear. Missing categories are not bad scores and must not lower the overall score.

Evaluate these categories when visible: outfit cohesion, color coordination, fit and silhouette, shoes, and styling. Calculate overall_score using only categories with visibility visible and these weights renormalized across the visible categories: outfit 30%, color 20%, fit 20%, shoes 15%, styling 15%. Do not give automatic high scores; use the full 0–10 range honestly. A lower confidence result can still have a useful score when image_quality is good or usable.

Return JSON only. Keep every reason and summary grounded in visible clothing. Mention unavailable categories in the summary when useful. Never comment on attractiveness, body shape, weight, age, gender, identity, or the person as a person.`;

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function normalizeCategory(category: FitCheckResult["scores"][CategoryKey]) {
  if (category.visibility !== "visible" || category.score === null) {
    return { ...category, score: null };
  }
  return { ...category, score: clampScore(category.score) };
}

export function normalizeResult(raw: FitCheckResult): FitCheckResult {
  const scores = {
    outfit: normalizeCategory(raw.scores.outfit),
    color: normalizeCategory(raw.scores.color),
    fit: normalizeCategory(raw.scores.fit),
    shoes: normalizeCategory(raw.scores.shoes),
    styling: normalizeCategory(raw.scores.styling),
  };
  const weights: Record<CategoryKey, number> = { outfit: 0.3, color: 0.2, fit: 0.2, shoes: 0.15, styling: 0.15 };
  const visibleCategories = CATEGORY_KEYS.filter((key) => scores[key].visibility === "visible" && scores[key].score !== null);
  const weightTotal = visibleCategories.reduce((total, key) => total + weights[key], 0);
  const weighted = weightTotal === 0 ? 0 : visibleCategories.reduce((total, key) => total + (scores[key].score ?? 0) * weights[key], 0) / weightTotal;
  const unavailableCategories = CATEGORY_KEYS.filter((key) => scores[key].visibility !== "visible");
  const unusable = raw.image_quality === "insufficient" || visibleCategories.length === 0;
  return {
    overall_score: unusable ? 0 : clampScore(weighted),
    confidence: Math.max(0, Math.min(1, raw.confidence)),
    image_quality: raw.image_quality,
    coverage: { visible_categories: visibleCategories, unavailable_categories: unavailableCategories },
    scores,
    verdict: unusable ? "Can’t judge this fit reliably." : raw.verdict.trim(),
    strengths: raw.strengths.slice(0, 3).map((item) => item.trim()),
    improvements: unusable ? ["Try a brighter photo with more of the outfit visible."] : raw.improvements.slice(0, 3).map((item) => item.trim()),
    summary: raw.summary.trim(),
  };
}

function isRetryableGeminiError(error: unknown) {
  const status = Number((error as { status?: number })?.status);
  return status === 408 || status === 429 || status >= 500 || error instanceof TypeError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithTemporaryRetry(ai: GoogleGenAI, request: Parameters<typeof ai.models.generateContent>[0]) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      if (attempt === maxAttempts - 1 || !isRetryableGeminiError(error)) throw error;
      await sleep(350 * 2 ** attempt);
    }
  }
  throw new Error("GEMINI_REQUEST_FAILED");
}

export async function analyzeFitWithGemini({ imageDataUrl, category }: { imageDataUrl: string; category?: string }) {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("INVALID_IMAGE_DATA");
  const [, mimeType, data] = match;
  if (!mimeType || !data || data.length > MAX_IMAGE_DATA_LENGTH) throw new Error("INVALID_IMAGE_DATA");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const ai = new GoogleGenAI({ apiKey });
  const categoryHint = category ? `The user optionally tagged this look as: ${category}. Use it only as context, not as proof.` : "No outfit category was provided.";
  const request = {
    model: GEMINI_MODEL,
    contents: [{
      role: "user" as const,
      parts: [
        { inlineData: { mimeType, data } },
        { text: `${categoryHint}\nAnalyze this outfit for Fit Check in one pass. Return only the requested structured JSON.` },
      ],
    }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: fitCheckResponseSchema,
      temperature: 0.2,
    },
  };

  const requestPromise = generateWithTemporaryRetry(ai, request);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), REQUEST_TIMEOUT_MS));
  const response = await Promise.race([requestPromise, timeout]);
  const text = response.text?.trim();
  if (!text) throw new Error("EMPTY_GEMINI_RESPONSE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_GEMINI_JSON");
  }
  const result = fitCheckResultSchema.safeParse(parsed);
  if (!result.success) throw new Error("INVALID_GEMINI_RESULT");
  return normalizeResult(result.data);
}
