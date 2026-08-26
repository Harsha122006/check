# FitCheck persistence

FitCheck keeps the existing configured MySQL/TiDB database and Manus-managed S3-compatible storage rather than introducing Supabase credentials. The project already has a working Drizzle connection, Manus OAuth identity, and server-only storage helpers, so this avoids adding a second authentication and data plane.

## Data model

`users` stores the existing Manus OAuth profile. `outfits` stores one owned image reference per analysis request, category, processing status, and error code. `outfit_analyses` stores the validated Gemini result, nullable category scores, confidence, verdict, summary, feedback arrays, and coverage metadata. An outfit has one analysis, and the two feature tables use cascading foreign keys.

## Request flow

Authenticated clients use `fitCheck.analyzeAndPersist`: the server validates the data URL, uploads bytes through `storagePut`, creates a `processing` outfit row with a unique per-user request ID, invokes the existing Gemini evaluator, writes the validated analysis, and changes the outfit to `completed`. Failures change the row to `failed` without fabricating a score. `fitCheck.history`, `fitCheck.get`, and `fitCheck.delete` are protected by the existing `protectedProcedure` and always filter by the authenticated user ID.

## Storage and deletion

Image bytes are not stored in the database. The built-in storage helper returns a managed `/manus-storage/{key}` reference and does not expose an object-delete API. Deletion therefore removes the owned analysis and outfit database rows, making the object unreferenced and inaccessible through FitCheck history. If hard object deletion or retention guarantees are required, the project must be upgraded to a storage provider/API that exposes server-side delete operations; no service-role or storage credential is exposed to the browser.

## Required manual verification

A signed-in browser session should still be used to verify the complete sequence: upload an image, wait for Gemini, confirm the saved row appears after refresh, open it from Archive, delete it, and confirm it no longer appears. The current automated checks cover the analysis pipeline and the project builds successfully; the available browser session was unauthenticated during this persistence pass.
