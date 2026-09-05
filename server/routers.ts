import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { analyzeFitWithGemini, FitCheckError, type FitCheckResult } from "./fitcheck";
import { createOutfitRecord, completeOutfitRecord, deleteUserOutfit, failOutfitRecord, findCompletedOutfitByFingerprint, getUserOutfit, listUserOutfits } from "./db";
import { storagePut } from "./storage";
import { fingerprintImageBytes } from "./imageFingerprint";
import { buildAnalysisCacheKey, PUBLIC_ANALYSIS_CACHE_LIMIT, trimAnalysisCache } from "./analysisCache";

const publicAnalysisCache = new Map<string, FitCheckResult>();

function mapFitCheckError(error: unknown): TRPCError {
  if (error instanceof FitCheckError) {
    const mapped: Record<FitCheckError["code"], { code: "BAD_REQUEST" | "TIMEOUT" | "TOO_MANY_REQUESTS" | "PRECONDITION_FAILED" | "BAD_GATEWAY" | "INTERNAL_SERVER_ERROR"; message: string }> = {
      IMAGE_PROBLEM: { code: "BAD_REQUEST", message: "Try a clearer photo — we need to be able to see your outfit." },
      API_TIMEOUT: { code: "TIMEOUT", message: "That took longer than expected. Try again." },
      RATE_LIMIT: { code: "TOO_MANY_REQUESTS", message: "Fit Check is getting a lot of requests right now. Try again in a moment." },
      SERVER_ERROR: { code: "BAD_GATEWAY", message: "Something went wrong on our side. Try again." },
      INVALID_API_KEY: { code: "PRECONDITION_FAILED", message: "AI service configuration error." },
      INVALID_REQUEST: { code: "BAD_REQUEST", message: "Try a different image file and try again." },
      REQUEST_CANCELLED: { code: "TIMEOUT", message: "That fit read was cancelled. Try again when you’re ready." },
      INVALID_GEMINI_RESPONSE: { code: "BAD_GATEWAY", message: "The fit read came back incomplete. Please try again." },
    };
    const result = mapped[error.code];
    return new TRPCError({ code: result.code, message: result.message, cause: error.cause });
  }
  return new TRPCError({ code: "BAD_GATEWAY", message: "Something went wrong on our side. Try again.", cause: error });
}

const analysisInput = z.object({
  imageDataUrl: z.string().min(32).max(750_000),
  category: z.string().trim().max(32).optional(),
  occasion: z.string().trim().max(32).optional(),
});

function dataUrlToBytes(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Try a JPG, PNG, or WebP image file." });
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function cachedAnalysisToResult(cached: NonNullable<Awaited<ReturnType<typeof findCompletedOutfitByFingerprint>>>): FitCheckResult {
  const { analysis } = cached;
  const coverage = analysis.coverage as FitCheckResult["coverage"];
  const unavailable = coverage.unavailable_categories;
  const category = (value: number | null, key: keyof FitCheckResult["scores"]) => ({
    score: value === null ? null : value / 10,
    visibility: unavailable.includes(key) ? "not_visible" as const : "visible" as const,
    reason: unavailable.includes(key) ? "Not visible in this frame." : "Evaluated from the visible frame.",
  });
  return {
    overall_score: analysis.overallScore / 10,
    confidence: analysis.confidence / 100,
    image_quality: "good",
    coverage,
    scores: {
      outfit: category(analysis.outfitScore, "outfit"),
      color: category(analysis.colorScore, "color"),
      fit: category(analysis.fitScore, "fit"),
      shoes: category(analysis.shoesScore, "shoes"),
      styling: category(analysis.stylingScore, "styling"),
      occasion_suitability: category(analysis.occasionSuitabilityScore ?? null, "occasion_suitability"),
    },
    occasion: cached.outfit.category ?? undefined,
    verdict: analysis.verdict,
    strengths: analysis.strengths,
    improvements: analysis.improvements,
    summary: analysis.summary,
  };
}

async function analyzeWithAbort(ctx: Pick<TrpcContext, "req">, input: z.infer<typeof analysisInput>) {
  const controller = new AbortController();
  const onAborted = () => controller.abort();
  ctx.req.once("aborted", onAborted);
  ctx.req.once("close", onAborted);
  try {
    return await analyzeFitWithGemini({ ...input, signal: controller.signal });
  } finally {
    ctx.req.off("aborted", onAborted);
    ctx.req.off("close", onAborted);
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  fitCheck: router({
    analyze: publicProcedure.input(analysisInput).mutation(async ({ ctx, input }) => {
      try {
        const { bytes } = dataUrlToBytes(input.imageDataUrl);
        const occasion = input.occasion ?? input.category ?? "Casual";
        const cacheKey = buildAnalysisCacheKey(fingerprintImageBytes(bytes), occasion);
        const cached = publicAnalysisCache.get(cacheKey);
        if (cached) return cached;
        const result = await analyzeWithAbort(ctx, { ...input, category: occasion, occasion });
        publicAnalysisCache.set(cacheKey, result);
        trimAnalysisCache(publicAnalysisCache, PUBLIC_ANALYSIS_CACHE_LIMIT);
        return result;
      } catch (error) {
        if (!(error instanceof FitCheckError) || error.code !== "REQUEST_CANCELLED") console.error("[FitCheck] request failed", error);
        throw mapFitCheckError(error);
      }
    }),

    analyzeAndPersist: protectedProcedure.input(analysisInput.extend({ requestId: z.string().uuid(), originalName: z.string().trim().max(255).optional() })).mutation(async ({ ctx, input }) => {
      const { mimeType, bytes } = dataUrlToBytes(input.imageDataUrl);
      const imageFingerprint = fingerprintImageBytes(bytes);
      const occasion = input.occasion ?? input.category ?? "Casual";
      const cached = await findCompletedOutfitByFingerprint(ctx.user.id, imageFingerprint, occasion);
      if (cached?.analysis) {
        return { outfitId: cached.outfit.id, imageUrl: cached.outfit.imageUrl, result: cachedAnalysisToResult(cached), cached: true as const };
      }
      const storage = await storagePut(`outfits/${ctx.user.id}/${input.requestId}/original`, bytes, mimeType);
      const outfit = await createOutfitRecord({ userId: ctx.user.id, requestId: input.requestId, imageKey: storage.key, imageUrl: storage.url, imageFingerprint, originalName: input.originalName, category: occasion });
      try {
        const result = await analyzeWithAbort(ctx, { ...input, category: occasion, occasion });
        await completeOutfitRecord(outfit.id, result);
        return { outfitId: outfit.id, imageUrl: storage.url, result };
      } catch (error) {
        const code = error instanceof FitCheckError ? error.code : "SERVER_ERROR";
        await failOutfitRecord(outfit.id, code);
        if (!(error instanceof FitCheckError) || error.code !== "REQUEST_CANCELLED") console.error("[FitCheck] persisted request failed", error);
        throw mapFitCheckError(error);
      }
    }),

    history: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(24), offset: z.number().int().min(0).default(0) })).query(({ ctx, input }) => listUserOutfits(ctx.user.id, input.limit, input.offset)),
    get: protectedProcedure.input(z.object({ outfitId: z.number().int().positive() })).query(({ ctx, input }) => getUserOutfit(ctx.user.id, input.outfitId)),
    delete: protectedProcedure.input(z.object({ outfitId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteUserOutfit(ctx.user.id, input.outfitId)),
  }),
});

export type AppRouter = typeof appRouter;
