import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { analyzeFitWithGemini } from "./fitcheck";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  fitCheck: router({
    analyze: publicProcedure
      .input(z.object({
        imageDataUrl: z.string().min(32).max(750_000),
        category: z.string().trim().max(32).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await analyzeFitWithGemini(input);
        } catch (error) {
          const code = error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED";
          if (code === "INVALID_IMAGE_DATA") throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a valid image file." });
          if (code === "GEMINI_NOT_CONFIGURED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Fit analysis is not configured yet." });
          if (code === "GEMINI_TIMEOUT") throw new TRPCError({ code: "TIMEOUT", message: "The fit read took too long. Please try again." });
          if (code.startsWith("INVALID_GEMINI") || code === "EMPTY_GEMINI_RESPONSE") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The fit read came back incomplete. Please retry." });
          console.error("[FitCheck] Gemini analysis failed", error);
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not reach the fit reader. Please retry." });
        }
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
