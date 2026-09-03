import { z } from "zod";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";

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
  anyOf: [{ type: "number" }, { type: "null" }],
  description: "A score from 0 to 10, or null when the category is not visible enough to evaluate.",
};

const categoryResponseSchema = {
  type: "object",
  properties: {
    score: nullableScore,
    visibility: { type: "string", enum: ["visible", "not_visible", "unclear"] },
    reason: { type: "string" },
  },
  required: ["score", "visibility", "reason"],
};

const fitCheckResponseSchema = {
  type: "object",
  properties: {
    overall_score: { type: "number", description: "Dynamic weighted score from 0 to 10 using only categories with visibility visible. Use 0 only when image_quality is insufficient." },
    confidence: { type: "number", description: "Confidence from 0 to 1. Lower it for crop, blur, obstruction, poor lighting, or missing details, but do not fail a usable partial image." },
    image_quality: { type: "string", enum: ["good", "usable", "insufficient"] },
    coverage: {
      type: "object",
      properties: {
        visible_categories: { type: "array", items: { type: "string", enum: CATEGORY_KEYS } },
        unavailable_categories: { type: "array", items: { type: "string", enum: CATEGORY_KEYS } },
      },
      required: ["visible_categories", "unavailable_categories"],
    },
    scores: {
      type: "object",
      properties: {
        outfit: categoryResponseSchema,
        color: categoryResponseSchema,
        fit: categoryResponseSchema,
        shoes: categoryResponseSchema,
        styling: categoryResponseSchema,
      },
      required: [...CATEGORY_KEYS],
    },
    verdict: { type: "string", description: "A short honest verdict, maximum 6 words." },
    strengths: { type: "array", items: { type: "string", maxLength: 140 }, maxItems: 1, description: "One short clothing-only sentence, 5–12 words when possible." },
    improvements: { type: "array", items: { type: "string", maxLength: 180 }, maxItems: 1, description: "One actionable clothing-only change, 5–12 words when possible." },
    summary: { type: "string", maxLength: 220, description: "One short clothing-only sentence; do not write an essay." },
  },
  required: ["overall_score", "confidence", "image_quality", "coverage", "scores", "verdict", "strengths", "improvements", "summary"],
};

const systemInstruction = `You are Fit Check, a consistent professional clothing-rating engine. Evaluate the outfit as a combination of garments, never the person wearing it.

Ignore face, hair, skin, body shape or size, height, physique, pose, expression, body language, attractiveness, personality, confidence, background, location, environment, lighting, camera quality, and photography composition. None of those may affect any score, confidence value, verdict, strength, improvement, or summary.

First identify only clothing visibility: outfit cohesion, color coordination, fit/silhouette, shoes, and styling/presentation. Never invent hidden garments, brands, colors, materials, logos, patterns, proportions, or fit. If a clothing area is cropped, covered, or impossible to judge, use score null and visibility not_visible or unclear. Missing clothing is not a bad score and must not lower the score. Confidence describes available clothing evidence only; outfit quality and confidence are separate.

Score each visible category against the fixed 0–10 rubric: 0–2 extremely poor, 3–4 weak, 5 average, 6 decent, 7 good, 8 very good, 9 excellent, 10 exceptional. Use the full range honestly and keep the wording aligned with the score. The server derives overall_score mathematically from visible categories using fixed weights: outfit cohesion 30%, color 20%, fit/silhouette 20%, shoes 15%, styling/presentation 15%, renormalized only across visible categories. Return a neutral overall_score placeholder; do not calculate or invent it.

Return JSON only. Keep every reason under 120 characters, verdict under 6 words, strengths and improvements to one short clothing-only sentence each, and summary to one short clothing-only sentence. The single improvement must be the highest-impact actionable garment or styling change, or say the current clothing combination is already working. Never mention the person, their body, face, lighting, background, image quality, or photography.`;

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
  const unusable = visibleCategories.length === 0;
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
    const trimmed = text.trim();
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    parsed = JSON.parse(candidate);
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

  if (!ENV.forgeApiKey) throw new FitCheckError("INVALID_API_KEY", "AI service configuration error.");
  const categoryHint = category ? `The user optionally tagged this look as: ${category}. Use it only as context, not as proof.` : "No outfit category was provided.";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.geminiTimeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });
  diagnostic.timeout_ms = ENV.geminiTimeoutMs;
  try {
    let parsedResult: FitCheckResult | null = null;
    let parseRecoveryCount = 0;
    while (parseRecoveryCount < 2 && !parsedResult) {
      const geminiStartedAt = performance.now();
      const response = await invokeLLM({
        model: ENV.geminiModel,
        signal: controller.signal,
            maxTokens: 3200,
            temperature: 0,
            messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}`, detail: "high" } },
            { type: "text", text: `${categoryHint}\nAnalyze this outfit for Fit Check in one pass. Return only the requested structured JSON.` },
          ] },
        ],
        responseFormat: { type: "json_schema", json_schema: { name: "fit_check_result", strict: true, schema: fitCheckResponseSchema as Record<string, unknown> } },
      });
      diagnostic.retry_count = 0;
      diagnostic.api_status = 200;
      diagnostic.gemini_request_duration_ms = Number((performance.now() - geminiStartedAt).toFixed(1));
      const parseStartedAt = performance.now();
      const choice = response.choices?.[0];
      const message = choice?.message;
      diagnostic.response_keys = Object.keys(response);
      diagnostic.response_choice_keys = choice ? Object.keys(choice) : undefined;
      diagnostic.response_message_keys = message ? Object.keys(message) : undefined;
      diagnostic.response_finish_reason = choice?.finish_reason;
      const content = message?.content;
      diagnostic.response_content_type = Array.isArray(content) ? "array" : typeof content;
      diagnostic.response_content_keys = content && typeof content === "object" && !Array.isArray(content) ? Object.keys(content) : undefined;
      const text = typeof content === "string" ? content.trim() : content?.filter((part) => part.type === "text").map((part) => part.text).join(" ").trim() ?? "";
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
