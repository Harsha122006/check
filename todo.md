# Fit Check Gemini pipeline hardening checklist

- [x] Diagnose the current sources of slow requests and failures before changing behavior.
- [x] Keep the existing UI, Gemini provider, partial-image scoring, and core app functionality intact.
- [x] Add a bounded server-side Gemini timeout with stale-request cancellation where possible.
- [x] Add 1–2 controlled exponential-backoff retries only for network, 429, and 5xx failures.
- [x] Add differentiated safe frontend errors for image, timeout, rate-limit, server, and configuration failures.
- [x] Make the Gemini model configurable through GEMINI_MODEL with a current fast default.
- [x] Add request diagnostics with request ID, timing, payload metadata, retry count, status, parse state, and safe error category.
- [x] Record upload, Gemini, parse, and total analysis durations in development logs.
- [x] Keep a single image → single Gemini structured-response request per submission.
- [x] Prevent duplicate submissions and cancel stale client requests where possible.
- [x] Preserve honest partial-image coverage and unavailable-category rendering.
- [x] Test formats, size handling, partial images, timeout, 429, 5xx, malformed JSON, duplicate submit, cancellation, and success.
- [x] Run final typecheck/tests/build and save a new checkpoint.

- [x] Add deterministic validation for JPEG, PNG, and WebP input metadata handling.
- [x] Add deterministic coverage for malformed JSON recovery, timeout mapping, rate-limit mapping, duplicate-submit guard, and stale-request protection.
- [x] Run and record the post-hardening end-to-end Gemini result attempt; live success was blocked by Gemini service responsiveness and the UI safely surfaced a retryable timeout.
- [x] Save a new checkpoint after the complete validation matrix passes.

- [x] Add deterministic JPEG and WebP dimension parsing tests.
- [x] Add deterministic tests for malformed-response recovery, timeout-to-public-error mapping, duplicate-submit suppression, and stale-response ignoring.
- [x] Record the post-hardening Gemini live timeout as an external service-availability blocker unless a successful results response is observed.
- [x] Save a fresh checkpoint after the remaining validation work is documented.
