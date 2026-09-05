import { int, index, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const outfits = mysqlTable("outfits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestId: varchar("requestId", { length: 64 }).notNull(),
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 768 }).notNull(),
  imageFingerprint: varchar("imageFingerprint", { length: 64 }),
  originalName: varchar("originalName", { length: 255 }),
  category: varchar("category", { length: 32 }),
  analysisStatus: mysqlEnum("analysisStatus", ["processing", "completed", "failed"]).default("processing").notNull(),
  errorCode: varchar("errorCode", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("outfits_user_created_idx").on(table.userId, table.createdAt),
  userFingerprintIdx: index("outfits_user_fingerprint_idx").on(table.userId, table.imageFingerprint),
  requestUniqueIdx: uniqueIndex("outfits_user_request_unique").on(table.userId, table.requestId),
}));

export type Outfit = typeof outfits.$inferSelect;
export type InsertOutfit = typeof outfits.$inferInsert;

export const outfitAnalyses = mysqlTable("outfit_analyses", {
  id: int("id").autoincrement().primaryKey(),
  outfitId: int("outfitId").notNull().references(() => outfits.id, { onDelete: "cascade" }),
  outfitScore: int("outfitScore"),
  colorScore: int("colorScore"),
  fitScore: int("fitScore"),
  shoesScore: int("shoesScore"),
  stylingScore: int("stylingScore"),
  occasionSuitabilityScore: int("occasionSuitabilityScore"),
  overallScore: int("overallScore").notNull(),
  confidence: int("confidence").notNull(),
  verdict: text("verdict").notNull(),
  summary: text("summary").notNull(),
  strengths: json("strengths").$type<string[]>().notNull(),
  improvements: json("improvements").$type<string[]>().notNull(),
  coverage: json("coverage").$type<{ visible_categories: string[]; unavailable_categories: string[] }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  outfitIdx: uniqueIndex("outfit_analyses_outfit_unique").on(table.outfitId),
}));

export type OutfitAnalysis = typeof outfitAnalyses.$inferSelect;
export type InsertOutfitAnalysis = typeof outfitAnalyses.$inferInsert;
