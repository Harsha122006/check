# FitCheck occasion-aware validation

The occasion-aware evaluator now accepts the selected occasion from the existing selector, includes it in the structured response, applies fixed criteria, and separates exact-image cache identity by occasion.

| Validation | Evidence | Result |
|---|---|---|
| Supported occasions | `server/analysisCache.test.ts` checks Casual, Formal, College, Party, Date, Streetwear, and Other criteria | Passed |
| Occasion influence | `server/fitcheck.test.ts` holds every category constant and changes only `occasion_suitability`; the higher suitability score produces a higher overall score | Passed |
| Same-fixture occasion matrix | The same normalized outfit fixture is evaluated once as Casual with 8.5 occasion suitability and once as Formal with 5.5; both preserve the same non-occasion scores, the Casual result is higher, and the selected occasion labels differ | Passed |
| Exact-image cache separation | `server/analysisCache.test.ts` verifies the same fingerprint produces different keys for Casual and Formal, while repeated same-occasion keys match | Passed |
| Persistent lookup scope | `findCompletedOutfitByFingerprint` now includes the selected occasion/category in its ownership-safe query | Implemented |
| Regression suite | 7 Vitest files, including occasion cache tests, haptics, normalization, app, auth, secret, and fingerprint tests | 35 tests passed |
| TypeScript and build | `pnpm exec tsc --noEmit` and `pnpm build` | Passed |

This is deterministic fixture and contract validation. A live multi-occasion Gemini comparison on the same uploaded file still depends on the configured provider response and browser upload session, but the request, normalization, public cache, and persistent lookup paths now keep occasions separate.
