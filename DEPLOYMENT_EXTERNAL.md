# FitCheck: GitHub and Vercel deployment

## Current framework

FitCheck is a full-stack TypeScript application built with **React 19, Vite 7, Tailwind CSS 4, Express 4, tRPC 11, Drizzle ORM, and MySQL/TiDB**. The browser bundle is built from `client/` into `dist/public`; the Node server is assembled from `server/_core/index.ts` and the shared application factory in `server/app.ts`.

The repository includes the application source, database schema and migrations, server procedures, authentication flow, storage adapters, frontend components, tests, TypeScript configuration, Vite configuration, lockfile, and the new Vercel function entrypoints. The repository intentionally excludes `.env*`, `dist/`, `node_modules/`, Manus project metadata, and logs through `.gitignore`.

## Safe export from Manus

The safest no-secret export path is:

1. Open the FitCheck project in Manus Management UI.
2. Open **Code**.
3. Choose **Download all files** and save the generated archive locally.
4. Extract it into a new local folder.
5. Confirm that `package.json`, `pnpm-lock.yaml`, `client/`, `server/`, `shared/`, `drizzle/`, `api/`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, and this guide are present.
6. Alternatively, use **Settings → GitHub** to export the project directly to a new repository under an owner and repository name you control.
7. Never commit `.env`, `.env.local`, downloaded secret files, database dumps, or credentials.

For a manual GitHub upload after downloading:

```bash
cd fitcheck
git init
git add .
git commit -m "Export FitCheck from Manus"
git branch -M main
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

## Build outside Manus

The repository can build outside Manus with Node.js 22, pnpm, and a network connection:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

The build creates `dist/public` for the Vite frontend and `dist/index.js` for the existing Node server bundle. Vercel should use `pnpm build` as its build command and `dist/public` as the frontend output directory. The included `vercel.json` supplies the SPA deep-link rewrite, and `api/[...path].ts` exposes the Express/tRPC application as a Vercel Node function.

Vercel’s current guidance confirms that Vite projects can deploy from Git and that SPA deep links require a rewrite when using SPA mode [1]. Vercel also supports Express applications as Node functions, with the application exported from a supported server entrypoint [2].

## What remains Manus-specific

The source is build-portable, but the production feature set is not provider-independent yet. The current application deliberately uses Manus-compatible service adapters:

| Feature | Current implementation | External deployment requirement |
|---|---|---|
| AI outfit analysis | `invokeLLM()` calls the Manus Forge-compatible OpenAI-style endpoint with multimodal input and structured JSON | Keep a compatible Forge endpoint and token, or replace `server/_core/llm.ts` with a direct Gemini/OpenAI/another-provider adapter |
| Image upload and retrieval | Managed storage through Forge presign APIs and `/manus-storage/*` proxy | Keep Forge storage access, or replace `server/storage.ts` and `server/_core/storageProxy.ts` with S3/R2/Supabase Storage and configure public/private delivery |
| Authentication | Manus OAuth callback, session JWT, and Manus SDK | Keep a registered Manus OAuth app with the new Vercel callback URL, or replace `server/_core/oauth.ts`, `server/_core/sdk.ts`, and the client login trigger with Auth.js, Clerk, Supabase Auth, or another provider |
| Database | Drizzle ORM over MySQL/TiDB | Provision an externally reachable MySQL/TiDB-compatible database and apply the committed Drizzle migrations |
| Analytics/debug collector | Manus runtime plugin and development-only diagnostics | Optional outside Manus; remove the plugin/debug collector if not desired |

Therefore, **do not switch the live Manus deployment or rotate existing credentials as part of this export**. The Vercel function scaffold is safe to commit, but a fully provider-independent deployment requires choosing replacement providers for AI, storage, and authentication first.

## Vercel environment variables

Vercel encrypts project environment variables and applies changes only to new deployments [3]. Add the following values in the Vercel dashboard under **Project → Settings → Environment Variables**, separately for Development, Preview, and Production as appropriate.

### Required for the current Manus-compatible runtime

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | Server-only | MySQL/TiDB connection string for Drizzle and user/outfit persistence |
| `JWT_SECRET` | Server-only | Session-cookie signing secret; use a new long random value for the external deployment unless intentionally sharing sessions |
| `VITE_APP_ID` | Server and build | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Server-only | OAuth token and user-info service base URL |
| `VITE_OAUTH_PORTAL_URL` | Browser build | OAuth sign-in portal URL |
| `BUILT_IN_FORGE_API_URL` | Server-only | Forge-compatible LLM and storage API base URL |
| `BUILT_IN_FORGE_API_KEY` | Server-only | Forge bearer token used for multimodal analysis and managed storage |
| `GEMINI_MODEL` | Server-only | Model identifier sent through the Forge-compatible LLM route; current default is `gemini-3-flash-preview` |
| `GEMINI_TIMEOUT_MS` | Server-only | Analysis timeout; current default is `15000` |

Register the exact Vercel production callback URL with the OAuth application, normally:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/oauth/callback
```

Also register every Preview-domain callback you intend to use, or use a stable custom domain for production authentication.

### Optional or feature-specific variables

| Variable | When needed |
|---|---|
| `OWNER_OPEN_ID` | Framework-level owner-only features |
| `OWNER_NAME` | Framework-level owner metadata |
| `VITE_FRONTEND_FORGE_API_URL` | Only if the browser-side Map component is enabled |
| `VITE_FRONTEND_FORGE_API_KEY` | Only if the browser-side Map component is enabled; treat it as browser-exposed, not a server secret |
| `GEMINI_API_KEY` | Current repository test/diagnostic compatibility only; production analysis currently uses `BUILT_IN_FORGE_API_URL` through `invokeLLM()` |
| `VITE_APP_TITLE` | Optional external branding override if the host application uses it |
| `VITE_APP_LOGO` | Optional external branding override if the host application uses it |
| `VITE_ANALYTICS_ENDPOINT` | Optional analytics integration |
| `VITE_ANALYTICS_WEBSITE_ID` | Optional analytics integration |

Never place `BUILT_IN_FORGE_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, or any OAuth server credential in a `VITE_*` variable. Vite exposes `VITE_*` variables to browser code.

## Vercel setup

1. Import the GitHub repository into Vercel.
2. Keep the repository root as the project root.
3. Use **pnpm** and the committed `pnpm-lock.yaml`.
4. Set the build command to `pnpm build`.
5. Set the output directory to `dist/public`.
6. Add the server-only and browser variables listed above.
7. Deploy a Preview first.
8. Test `/`, a client-side route, `/api/trpc`, sign-in, gallery upload, Gemini analysis, save, Archive refresh, protected retrieval, and delete.
9. Only after those checks pass, deploy Production.

The current Vercel configuration is an adapter scaffold, not proof that the Manus OAuth, Forge, and storage services will accept a new Vercel origin. Provider callback registration and external service access must be completed before the external deployment can provide the same production behavior as Manus.

## References

[1]: https://vercel.com/docs/frameworks/frontend/vite "Vercel: Vite on Vercel"
[2]: https://vercel.com/docs/frameworks/backend/express "Vercel: Express on Vercel"
[3]: https://vercel.com/docs/environment-variables "Vercel: Environment variables"
