# Fit Check Gemini reliability revision

- [x] Keep the existing UI, upload flow, results layout, and core functionality unchanged.
- [x] Expand the structured result schema with image quality, coverage, per-category visibility, score, and reason.
- [x] Update Gemini instructions to judge only visible clothing and never invent hidden items, brands, colors, materials, logos, patterns, or fit.
- [x] Allow cropped, upper-body, lower-body, mirror-selfie, and partially obstructed photos when enough clothing is visible.
- [x] Mark unavailable categories as not_visible with null scores instead of zero or failure.
- [x] Calculate the overall score dynamically from visible/evaluable categories only.
- [x] Add lightweight image-quality checks and reject only genuinely unusable images.
- [x] Keep one Gemini request per outfit, with compact image preprocessing, reasonable timeout, and temporary-failure retry only.
- [x] Update the existing results mapping to render partial coverage honestly.
- [x] Test full, cropped-shoes, upper-body, blurry, dark, excellent, weak, and no-shoes scenarios.
- [x] Run final typecheck/tests/build and save a new checkpoint.

- [x] Run representative image-based validation for cropped shoes, upper-body only, blurry usable, very dark unusable, no-shoes, strong, and weak fits through the live Gemini pipeline.
- [x] Save a new checkpoint after the reliability revision passes final validation.
