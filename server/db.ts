import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, outfitAnalyses, outfits, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] === undefined) continue;
    const value = user[field] ?? null;
    values[field] = value;
    updateSet[field] = value;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createOutfitRecord(input: {
  userId: number;
  requestId: string;
  imageKey: string;
  imageUrl: string;
  imageFingerprint?: string;
  originalName?: string;
  category?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(outfits).values({ ...input, analysisStatus: "processing" }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const rows = await db.select().from(outfits).where(and(eq(outfits.userId, input.userId), eq(outfits.requestId, input.requestId))).limit(1);
  if (!rows[0]) throw new Error("Failed to create outfit record");
  return rows[0];
}

export async function findCompletedOutfitByFingerprint(userId: number, imageFingerprint: string, occasion?: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ outfit: outfits, analysis: outfitAnalyses })
    .from(outfits)
    .innerJoin(outfitAnalyses, eq(outfits.id, outfitAnalyses.outfitId))
    .where(and(eq(outfits.userId, userId), eq(outfits.imageFingerprint, imageFingerprint), eq(outfits.analysisStatus, "completed"), occasion ? eq(outfits.category, occasion) : undefined))
    .orderBy(desc(outfits.createdAt))
    .limit(1);
  return rows[0];
}

export async function completeOutfitRecord(outfitId: number, result: {
  scores: { outfit: { score: number | null }; color: { score: number | null }; fit: { score: number | null }; shoes: { score: number | null }; styling: { score: number | null }; occasion_suitability?: { score: number | null } };
  overall_score: number;
  confidence: number;
  verdict: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  coverage: { visible_categories: string[]; unavailable_categories: string[] };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(outfitAnalyses).values({
    outfitId,
    outfitScore: result.scores.outfit.score === null ? null : Math.round(result.scores.outfit.score * 10),
    colorScore: result.scores.color.score === null ? null : Math.round(result.scores.color.score * 10),
    fitScore: result.scores.fit.score === null ? null : Math.round(result.scores.fit.score * 10),
    shoesScore: result.scores.shoes.score === null ? null : Math.round(result.scores.shoes.score * 10),
    stylingScore: result.scores.styling.score === null ? null : Math.round(result.scores.styling.score * 10),
    occasionSuitabilityScore: !result.scores.occasion_suitability || result.scores.occasion_suitability.score === null ? null : Math.round(result.scores.occasion_suitability.score * 10),
    overallScore: Math.round(result.overall_score * 10),
    confidence: Math.round(result.confidence * 100),
    verdict: result.verdict,
    summary: result.summary,
    strengths: result.strengths,
    improvements: result.improvements,
    coverage: result.coverage,
  }).onDuplicateKeyUpdate({ set: { overallScore: Math.round(result.overall_score * 10), confidence: Math.round(result.confidence * 100), verdict: result.verdict, summary: result.summary, strengths: result.strengths, improvements: result.improvements, coverage: result.coverage, occasionSuitabilityScore: !result.scores.occasion_suitability || result.scores.occasion_suitability.score === null ? null : Math.round(result.scores.occasion_suitability.score * 10) } });
  await db.update(outfits).set({ analysisStatus: "completed", errorCode: null }).where(eq(outfits.id, outfitId));
}

export async function failOutfitRecord(outfitId: number, errorCode: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(outfits).set({ analysisStatus: "failed", errorCode }).where(eq(outfits.id, outfitId));
}

export async function listUserOutfits(userId: number, limit = 24, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ outfit: outfits, analysis: outfitAnalyses }).from(outfits).leftJoin(outfitAnalyses, eq(outfits.id, outfitAnalyses.outfitId)).where(eq(outfits.userId, userId)).orderBy(desc(outfits.createdAt)).limit(limit).offset(offset);
}

export async function getUserOutfit(userId: number, outfitId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ outfit: outfits, analysis: outfitAnalyses }).from(outfits).leftJoin(outfitAnalyses, eq(outfits.id, outfitAnalyses.outfitId)).where(and(eq(outfits.userId, userId), eq(outfits.id, outfitId))).limit(1);
  return rows[0];
}

export async function deleteUserOutfit(userId: number, outfitId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const owned = await db.select({ id: outfits.id }).from(outfits).where(and(eq(outfits.id, outfitId), eq(outfits.userId, userId))).limit(1);
  if (!owned[0]) return { deleted: false } as const;
  await db.delete(outfitAnalyses).where(eq(outfitAnalyses.outfitId, outfitId));
  await db.delete(outfits).where(eq(outfits.id, outfitId));
  return { deleted: true } as const;
}
