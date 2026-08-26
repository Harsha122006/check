import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { analyzeFitWithGemini, FitCheckError } from "./fitcheck";

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
    analyze: publicProcedure
      .input(z.object({
        imageDataUrl: z.string().min(32).max(750_000),
        category: z.string().trim().max(32).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const controller = new AbortController();
        const onAborted = () => controller.abort();
        ctx.req.once("aborted", onAborted);
        ctx.req.once("close", onAborted);
        try {
          return await analyzeFitWithGemini({ ...input, signal: controller.signal });
        } catch (error) {
          if (!(error instanceof FitCheckError) || error.code !== "REQUEST_CANCELLED") {
            console.error("[FitCheck] request failed", error);
          }
          throw mapFitCheckError(error);
        } finally {
          ctx.req.off("aborted", onAborted);
          ctx.req.off("close", onAborted);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
