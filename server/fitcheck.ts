import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { ENV } from "./_core/env";

const MAX_IMAGE_DATA_LENGTH = 750_000;
const CATEGORY_KEYS = ["outfit", "color", "fit", "shoes", "styling"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type FitCheckErrorCode =
  | "IMAGE_PROBLEM"
  | "API_TIMEOUT"
  | "RATE_LIMIT"
  | "SERVER_ERROR"
  | "INVALID_API_KEY"
  | "INVALID_REQUEST"
  | "REQUEST_CANCELLED"
  | "INVALID_GEMINI_RESPONSE";

export class FitCheckError extends Error {
  constructor(public readonly code: FitCheckErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "FitCheckError";
  }
}

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
  if (category.visibility !== "visible" || category.score === null) return { ...category, score: null };
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

function errorStatus(error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown; error?: { code?: unknown } };
  const status = Number(candidate?.status ?? candidate?.error?.code ?? candidate?.code);
  return Number.isFinite(status) ? status : undefined;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
}

export function classifyGeminiError(error: unknown): FitCheckErrorCode {
  const status = errorStatus(error);
  const message = errorText(error);
  if (status === 401 || status === 403 || message.includes("api key") || message.includes("permission")) return "INVALID_API_KEY";
  if (status === 429 || message.includes("rate limit") || message.includes("too many requests")) return "RATE_LIMIT";
  if (status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504 || message.includes("network") || message.includes("fetch failed")) return "SERVER_ERROR";
  if (error instanceof TypeError) return "SERVER_ERROR";
  return "INVALID_REQUEST";
}

export function isRetryableGeminiError(error: unknown) {
  const status = errorStatus(error);
  return status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500) || error instanceof TypeError || errorText(error).includes("network");
}

export function getImageDimensions(mimeType: string, data: string) {
  try {
    const buffer = Buffer.from(data, "base64");
    if (mimeType === "image/png" && buffer.length > 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    if (mimeType === "image/gif" && buffer.length > 10) return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    if (mimeType === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF") {
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8X" && buffer.length > 30) return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (mimeType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    // Dimensions are diagnostics only; never fail a valid image because metadata parsing failed.
  }
  return undefined;
}

function logDiagnostic(event: string, diagnostic: Record<string, unknown>) {
  console.info(`[FitCheck] ${event} ${JSON.stringify(diagnostic)}`);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new FitCheckError("REQUEST_CANCELLED", "Request cancelled.")); }, { once: true });
  });
}

async function generateWithRetry(ai: GoogleGenAI, request: Parameters<typeof ai.models.generateContent>[0], signal: AbortSignal, diagnostic: Record<string, unknown>) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    diagnostic.retry_count = attempt;
    try {
      const response = await ai.models.generateContent(request);
      diagnostic.api_status = response.sdkHttpResponse?.responseInternal.status ?? 200;
      return response;
    } catch (error) {
      if (signal.aborted) throw new FitCheckError("REQUEST_CANCELLED", "Request cancelled.", error);
      diagnostic.api_status = errorStatus(error) ?? "unknown";
      diagnostic.error_category = classifyGeminiError(error);
      if (attempt === maxAttempts - 1 || !isRetryableGeminiError(error)) throw error;
      await sleep(350 * 2 ** attempt, signal);
    }
  }
  throw new Error("GEMINI_REQUEST_FAILED");
}

export function validateImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new FitCheckError("IMAGE_PROBLEM", "Try a clearer photo — we need to be able to see your outfit.");
  const [, mimeType, data] = match;
  if (!mimeType || !data || data.length > MAX_IMAGE_DATA_LENGTH) throw new FitCheckError("IMAGE_PROBLEM", "Try a clearer photo — we need to be able to see your outfit.");
  return { mimeType, data, dimensions: getImageDimensions(mimeType, data) };
}

export function parseFitCheckResponse(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FitCheckError("INVALID_GEMINI_RESPONSE", "The fit read came back incomplete.", error);
  }
  const result = fitCheckResultSchema.safeParse(parsed);
  if (!result.success) throw new FitCheckError("INVALID_GEMINI_RESPONSE", "The fit read came back incomplete.", result.error);
  return result.data;
}

export function parseWithRecovery(responses: string[]) {
  let lastError: unknown;
  for (let index = 0; index < Math.min(responses.length, 2); index += 1) {
    try {
      return parseFitCheckResponse(responses[index]);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new FitCheckError("INVALID_GEMINI_RESPONSE", "The fit read came back incomplete.");
}

export function toPublicAnalysisError(error: unknown, timedOut: boolean, externallyAborted: boolean) {
  if (timedOut) return new FitCheckError("API_TIMEOUT", "That took longer than expected. Try again.", error);
  if (externallyAborted) return new FitCheckError("REQUEST_CANCELLED", "Request cancelled.", error);
  return error instanceof FitCheckError ? error : new FitCheckError(classifyGeminiError(error), "The AI analysis is temporarily unavailable.", error);
}

export async function analyzeFitWithGemini({ imageDataUrl, category, signal }: { imageDataUrl: string; category?: string; signal?: AbortSignal }) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const { mimeType, data, dimensions } = validateImageDataUrl(imageDataUrl);
  const diagnostic: Record<string, unknown> = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    image_bytes: Math.floor(data.length * 0.75),
    image_data_length: data.length,
    image_dimensions: dimensions ?? "unknown",
    mime_type: mimeType,
    model: ENV.geminiModel,
    retry_count: 0,
  };
  logDiagnostic("analysis_start", diagnostic);

  if (!ENV.geminiApiKey) throw new FitCheckError("INVALID_API_KEY", "AI service configuration error.");
  const ai = new GoogleGenAI({ apiKey: ENV.geminiApiKey });
  const categoryHint = category ? `The user optionally tagged this look as: ${category}. Use it only as context, not as proof.` : "No outfit category was provided.";
  const request = {
    model: ENV.geminiModel,
    contents: [{ role: "user" as const, parts: [{ inlineData: { mimeType, data } }, { text: `${categoryHint}\nAnalyze this outfit for Fit Check in one pass. Return only the requested structured JSON.` }] }],
    config: { systemInstruction, responseMimeType: "application/json", responseSchema: fitCheckResponseSchema, temperature: 0.2, abortSignal: signal },
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.geminiTimeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });
  diagnostic.timeout_ms = ENV.geminiTimeoutMs;
  try {
    let parsedResult: FitCheckResult | null = null;
    let parseRecoveryCount = 0;
    const requestConfig = { ...request, config: { ...request.config, abortSignal: controller.signal } };
    while (parseRecoveryCount < 2 && !parsedResult) {
      const geminiStartedAt = performance.now();
      const response = await generateWithRetry(ai, requestConfig, controller.signal, diagnostic);
      diagnostic.gemini_request_duration_ms = Number((performance.now() - geminiStartedAt).toFixed(1));
      const parseStartedAt = performance.now();
      const text = response.text?.trim();
      try {
        parsedResult = parseFitCheckResponse(text ?? "");
        diagnostic.parsing_succeeded = true;
      } catch (error) {
        diagnostic.parsing_succeeded = false;
        diagnostic.error_category = "parse";
        diagnostic.parse_recovery_count = parseRecoveryCount;
        if (parseRecoveryCount === 1) throw error;
        parseRecoveryCount += 1;
        continue;
      }
      diagnostic.json_parse_duration_ms = Number((performance.now() - parseStartedAt).toFixed(1));
    }
    if (!parsedResult) throw new FitCheckError("INVALID_GEMINI_RESPONSE", "The fit read came back incomplete.");
    const normalized = normalizeResult(parsedResult);
    diagnostic.total_analysis_duration_ms = Number((performance.now() - startedAt).toFixed(1));
    diagnostic.error_category = null;
    logDiagnostic("analysis_complete", diagnostic);
    return normalized;
  } catch (error) {
    const timedOut = controller.signal.aborted && !(signal?.aborted);
    const finalError = toPublicAnalysisError(error, timedOut, Boolean(signal?.aborted));
    diagnostic.total_analysis_duration_ms = Number((performance.now() - startedAt).toFixed(1));
    diagnostic.error_category = finalError.code;
    diagnostic.parsing_succeeded = diagnostic.parsing_succeeded ?? false;
    logDiagnostic("analysis_failed", diagnostic);
    throw finalError;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
