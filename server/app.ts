import express from "express";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./_core/vite";

export async function createApp(options: { development?: boolean; server?: Server } = {}) {
  const app = express();
  const server = options.server ?? createServer(app);
  const development = options.development ?? process.env.NODE_ENV === "development";

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (development) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return { app, server };
}
