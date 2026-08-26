import "dotenv/config";
import type { Request, Response } from "express";
import { createApp } from "../server/app";

const appPromise = createApp({ development: false }).then(({ app }) => app);

export default async function handler(req: Request, res: Response) {
  const app = await appPromise;
  return app(req, res);
}
