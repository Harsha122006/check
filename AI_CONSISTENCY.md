# FitCheck AI Consistency and Interaction Notes

## Scoring architecture

FitCheck sends one compact structured multimodal request per uncached submission. Gemini returns category scores and evidence-grounded explanations; the server does not trust the generated overall score. `normalizeResult` clamps visible category scores to one decimal place, applies the fixed weights, renormalizes only when a category is genuinely unavailable, and rounds the derived overall score to one decimal place.

The current compatible category rubric is:

| Category | Weight |
|---|---:|
| Outfit cohesion | 30% |
| Color coordination | 20% |
| Fit and silhouette | 20% |
| Shoes | 15% |
| Styling and presentation | 15% |

The formula is `overall = (outfit × 0.30 + color × 0.20 + fit × 0.20 + shoes × 0.15 + styling × 0.15) / visible_weight_total`, rounded to one decimal place. When a category is not visible, its score is null and its weight is excluded from the denominator rather than treated as a zero.

The Gemini prompt now fixes the evaluation bands from 0–2 through 10, asks the model to judge execution rather than personal taste, requires observable evidence, and explicitly tells the model that the server derives the final overall score. Structured JSON output remains mandatory and the request uses temperature `0` through the shared LLM helper.

## Exact-image reuse

The client’s stable preprocessing pipeline rescales images to a maximum dimension of 768 pixels and re-encodes them as JPEG using the same quality policy. The server hashes the exact normalized bytes with SHA-256. In the authenticated path, the fingerprint is scoped to the current user and looked up against the most recent completed persisted outfit before storage or Gemini is called. A match returns the stored image and structured analysis immediately. In the public path, a bounded 32-entry in-process cache uses the fingerprint plus optional category as its key, so repeated identical uploads reuse the same structured result while that server instance is warm. The authenticated persistent path is the durable guarantee; the public cache is intentionally best-effort because stateless/serverless instances can be replaced.

This intentionally does not merge arbitrary near-duplicates such as screenshots or substantially different crops. Those images may alter visible evidence and should be analyzed normally rather than risking an incorrect cache hit. The fingerprint index is nullable and non-destructive so existing history remains valid.

## Interaction and performance

Optional vibration feedback is limited to successful image selection, analysis start, analysis completion, and final score reveal. Unsupported browsers silently fall back without affecting the flow. Primary button press feedback remains in the existing CSS interaction system, while the results animation uses the authoritative live score and no longer maintains a separate hardcoded score state.

The app keeps one core AI request per uncached submission, avoids long prose in the score request, preserves the existing bounded timeout/retry handling, keeps image preprocessing deterministic, and reuses cached exact-image analyses before uploading a new storage object. Existing clothing motion is CSS-based, pointer-safe, and reduced on small screens.

## Repeatability statement

For an authenticated user, the same normalized image bytes resolve to the same SHA-256 fingerprint. After the first successful analysis, subsequent exact repeats return the persisted result rather than invoking Gemini, making the score identical. For unauthenticated use, repeats on the same warm server instance return the cached structured result; a cold serverless instance may analyze again, but temperature `0`, fixed instructions, structured output, and programmatic normalization keep the result policy stable. Different images receive separate fingerprints and continue through the normal fixed-rubric evaluation path.
