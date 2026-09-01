# FitCheck GitHub Handoff

## Repository

FitCheck has been published to the selected repository:

**https://github.com/Harsha122006/Fitcheckai**

The source is on the `main` branch. The repository was empty before the first push, so the FitCheck source was added without overwriting existing project files.

## Use it as your project

Clone it locally with:

```bash
git clone https://github.com/Harsha122006/Fitcheckai.git
cd Fitcheckai
pnpm install
pnpm test
pnpm build
```

The repository includes the React/Vite client, Express/tRPC server, Drizzle schema and migrations, authentication integration, storage helpers, AI analysis pipeline, `package.json`, `pnpm-lock.yaml`, Vercel routing files, and deployment documentation. No `.env` files or secret key files were committed.

## Import into Vercel

1. Open [Vercel](https://vercel.com/new) and sign in with GitHub.
2. Select **Import Third-Party Git Repository** or choose the `Harsha122006/Fitcheckai` repository from the list.
3. Keep the repository root as the project root.
4. Select the project’s detected Node/Vite setup. The committed `vercel.json` provides the API catch-all and SPA routing configuration.
5. Add the environment variables listed in `DEPLOYMENT_EXTERNAL.md` before the first deployment.
6. Deploy, then test sign-in, image upload, AI analysis, save/history, retrieval, and deletion.

## Important provider note

The repository is source-portable and contains the Vercel entrypoint, but the current production features still rely on Manus-compatible Forge/OAuth/storage adapters unless those providers are replaced with external services and their credentials. Never commit API keys, OAuth secrets, database passwords, or `.env` files. Configure secrets in Vercel Project Settings → Environment Variables.

The current live Manus deployment remains separate and unchanged by this GitHub push.
