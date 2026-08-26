import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const GEMINI_MODEL = "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 60_000;

export const fitCheckResultSchema = z.object({
  overall_score: z.number().min(0).max(10),
  scores: z.object({
    outfit: z.number().min(0).max(10),
    color: z.number().min(0).max(10),
    fit: z.number().min(0).max(10),
    shoes: z.number().min(0).max(10),
    styling: z.number().min(0).max(10),
  }),
  verdict: z.string().min(1).max(80),
  strengths: z.array(z.string().min(1).max(140)).max(3),
  improvements: z.array(z.string().min(1).max(180)).max(3),
  summary: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1),
});

export type FitCheckResult = z.infer<typeof fitCheckResultSchema>;

const fitCheckResponseSchema = {
  type: Type.OBJECT,
  properties: {
    overall_score: { type: Type.NUMBER, description: "Weighted score from 0 to 10. Use 0 when the outfit cannot be evaluated reliably." },
    scores: {
      type: Type.OBJECT,
      properties: {
        outfit: { type: Type.NUMBER, description: "Overall outfit cohesion, 0 to 10." },
        color: { type: Type.NUMBER, description: "Color coordination, 0 to 10." },
        fit: { type: Type.NUMBER, description: "Fit and silhouette, 0 to 10." },
        shoes: { type: Type.NUMBER, description: "Footwear contribution, 0 to 10." },
        styling: { type: Type.NUMBER, description: "Styling choices and intentionality, 0 to 10." },
      },
      required: ["outfit", "color", "fit", "shoes", "styling"],
    },
    verdict: { type: Type.STRING, description: "A short honest verdict, maximum 6 words." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to three visible outfit strengths." },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to three concrete outfit improvements." },
    summary: { type: Type.STRING, description: "A concise constructive summary grounded in visible clothing details." },
    confidence: { type: Type.NUMBER, description: "Confidence that the image is clear enough to assess, from 0 to 1." },
  },
  required: ["overall_score", "scores", "verdict", "strengths", "improvements", "summary", "confidence"],
};

const systemInstruction = `You are Fit Check, a sharp but kind AI fashion critic for Gen Z users. Analyze ONLY the visible clothing, accessories, styling, color relationships, proportions, footwear, and context cues. Never comment on attractiveness, body shape, weight, age, gender, identity, or the person as a person.

Be honest and constructive. Do not inflate scores: a genuinely weak or mismatched outfit may score below 6, while an exceptional outfit may score above 9. Use the visible evidence only. If the photo is too blurry, dark, obstructed, cropped, or otherwise unreliable, set confidence below 0.45, use overall_score 0, return the verdict “Can’t judge this fit reliably.”, and explain that a clearer full-body photo is needed without inventing clothing details.

Score each category from 0 to 10. Calculate overall_score consistently using this weighting: outfit 30%, color 20%, fit 20%, shoes 15%, styling 15%. Round all scores to one decimal place. Keep strengths and improvements specific to visible items. Return JSON only, matching the requested schema exactly.`;

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

export function normalizeResult(raw: FitCheckResult): FitCheckResult {
  const scores = {
    outfit: clampScore(raw.scores.outfit),
    color: clampScore(raw.scores.color),
    fit: clampScore(raw.scores.fit),
    shoes: clampScore(raw.scores.shoes),
    styling: clampScore(raw.scores.styling),
  };
  const weighted = scores.outfit * 0.3 + scores.color * 0.2 + scores.fit * 0.2 + scores.shoes * 0.15 + scores.styling * 0.15;
  const lowConfidence = raw.confidence < 0.45;
  return {
    overall_score: lowConfidence ? 0 : clampScore(weighted),
    scores,
    verdict: lowConfidence ? "Can’t judge this fit reliably." : raw.verdict.trim(),
    strengths: raw.strengths.slice(0, 3).map((item) => item.trim()),
    improvements: lowConfidence ? ["Try a brighter full-body photo with the outfit clearly visible."] : raw.improvements.slice(0, 3).map((item) => item.trim()),
    summary: raw.summary.trim(),
    confidence: Math.max(0, Math.min(1, raw.confidence)),
  };
}

export async function analyzeFitWithGemini({ imageDataUrl, category }: { imageDataUrl: string; category?: string }) {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("INVALID_IMAGE_DATA");
  const [, mimeType, data] = match;
  if (!mimeType || !data || data.length > 12_000_000) throw new Error("INVALID_IMAGE_DATA");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const ai = new GoogleGenAI({ apiKey });
  const categoryHint = category ? `The user optionally tagged this look as: ${category}. Use it only as context, not as proof.` : "No outfit category was provided.";
  const request = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data } },
        { text: `${categoryHint}\nAnalyze this outfit for Fit Check. Identify what is visibly working and one to three practical changes that could improve the outfit.` },
      ],
    }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: fitCheckResponseSchema,
      temperature: 0.2,
    },
  });

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), REQUEST_TIMEOUT_MS));
  const response = await Promise.race([request, timeout]);
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
