# Hackathon Proof: Automated Cloud Deployment

This document is the repository section to submit for the hackathon item:

> "Provide a link to the section of your code that demonstrates you have automated the deployment process using scripts or infrastructure-as-code tools."

This write-up stays strict about proof. It only points to automation that is directly backed by tracked files in this repository.

## What To Submit

Submit the GitHub URL for this file:

`docs/hackathon-deployment-automation.md`

That gives judges one landing page with the explanation, the proof files, and copy-paste verification steps.

## Automation At A Glance

| Component | Automation type | Proof file | What it automates |
| --- | --- | --- | --- |
| Supabase Edge Functions | CI/CD workflow | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | On push to `master`, GitHub Actions runs validation and then deploys Supabase functions with the CLI |
| Mastra orchestrator | Containerized cloud deployment | [`mastra/Dockerfile`](../mastra/Dockerfile) and [`docs/deployments.md`](./deployments.md) | Builds the production image in a reproducible way and deploys it to Railway with `railway up` |
| Upstash Redis + QStash | Provisioning script | [`scripts/provision-upstash.sh`](../scripts/provision-upstash.sh) | Creates cloud resources and prints the exact env vars and secrets commands needed for integration |
| Supabase database schema | Deployment as code | [`supabase/migrations/`](../supabase/migrations/) and [`docs/deployments.md`](./deployments.md) | Versioned SQL migrations are pushed to the remote project with `supabase db push` |

## Step-By-Step Proof Walkthrough

### 1. GitHub Actions Automatically Deploys Supabase Functions

Primary proof file: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

What this shows:

- The workflow triggers on pull requests to `master` and pushes to `master`.
- The `lint-and-test` job runs typechecking, linting, and tests for both `web` and `mastra`.
- The `deploy-functions` job only runs on a `push` to `master`.
- That deploy job installs the Supabase CLI and executes `supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF"`.

Why this counts as deployment automation:

- Deployment is not a manual click path in a dashboard.
- The deploy step is encoded in version-controlled CI configuration.
- Validation runs before deployment, which makes the deployment flow reproducible and auditable.

### 2. Railway Deployment Is Scripted Through A Docker Build

Primary proof files: [`mastra/Dockerfile`](../mastra/Dockerfile) and [`docs/deployments.md`](./deployments.md)

What this shows:

- `mastra/Dockerfile` defines a multi-stage production build.
- The builder stage installs dependencies and compiles TypeScript.
- The runner stage installs production dependencies only and starts `node dist/index.js`.
- `docs/deployments.md` documents the exact deploy command: `cd mastra`, `npm run build`, `railway up`.

Why this counts as deployment automation:

- The production runtime is defined as code in the Dockerfile.
- The Railway deploy path is CLI-driven and repeatable.
- Any teammate can run the same checked-in steps and produce the same deployment artifact shape.

Important honesty note:

- This is automated deployment through scripted container build + CLI deployment.
- It is not currently triggered by a repo-hosted Railway CI workflow file.

### 3. Upstash Cloud Resources Are Provisioned By Script

Primary proof file: [`scripts/provision-upstash.sh`](../scripts/provision-upstash.sh)

What this shows:

- The script accepts an Upstash email and API key as inputs.
- It calls the Upstash REST API to create a Redis database.
- It fetches the user's QStash token.
- It prints the resulting `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `QSTASH_TOKEN`.
- It also prints the exact `supabase secrets set ...` commands needed to wire those resources into the deployed backend.

Why this counts as deployment automation:

- Cloud resource creation is encoded as a repeatable script instead of manual dashboard setup.
- The integration handoff is scripted too, which reduces setup drift between environments.

### 4. Supabase Schema And Functions Use Deployment-As-Code

Primary proof files: [`supabase/migrations/`](../supabase/migrations/), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), and [`docs/deployments.md`](./deployments.md)

What this shows:

- Database changes are stored as versioned SQL migration files under `supabase/migrations/`.
- The documented deployment path uses `supabase db push --project-ref <your-project-ref>` for schema rollout.
- The documented and CI-backed function deployment path uses `supabase functions deploy --project-ref <your-project-ref>`.

Why this counts as deployment automation:

- Infrastructure and backend rollout steps are expressed through tracked files and CLI commands.
- Schema history is preserved in version control instead of living only in a hosted dashboard.

## Copy-Paste Verification Steps

If a judge, organizer, or teammate wants to verify the proof quickly from a terminal, these are the fastest commands to run from the repository root.

### Quick proof scan

```bash
rg -n "deploy-functions|supabase functions deploy|supabase db push|railway up" \
  .github/workflows/ci.yml \
  docs/deployments.md
```

### Read the GitHub Actions deployment workflow

```bash
sed -n '1,120p' .github/workflows/ci.yml
```

### Read the Docker-based Railway deployment setup

```bash
sed -n '1,120p' mastra/Dockerfile
sed -n '1,120p' docs/deployments.md
```

### Read the Upstash provisioning automation

```bash
sed -n '1,200p' scripts/provision-upstash.sh
bash -n scripts/provision-upstash.sh
```

### Confirm migrations are tracked in the repo

```bash
ls -1 supabase/migrations | tail
```

### Read the documented end-to-end deployment commands

```bash
sed -n '80,120p' docs/deployments.md
```

## What Is Automated Vs. What Is Operator-Triggered

### Fully automated from the repo

- GitHub Actions automatically deploys Supabase Edge Functions on pushes to `master`, after validation passes.
- The Mastra production image is defined in code through the checked-in Dockerfile.
- Upstash provisioning is scripted end-to-end through a checked-in shell script.

### Scripted, but manually triggered

- Railway deployment still requires someone to run `railway up`.
- Supabase database rollout still requires someone to run `supabase db push`.

That is still valid deployment automation evidence for the hackathon prompt, because the deployment logic and provisioning logic are encoded as scripts and infrastructure configuration instead of being performed manually in cloud dashboards.

### Intentionally not counted as primary proof

- The repo includes [`vercel.json`](../vercel.json), and the architecture docs mention Vercel auto-deploys for the `web` app.
- This document does not rely on that as a primary proof point because the tracked repo evidence for Vercel deployment automation is minimal compared with the stronger CI, Docker, script, and migration-based proofs above.

## Direct Code Links

- [Hackathon proof landing page](./hackathon-deployment-automation.md)
- [Google Cloud deployment runbook](./google-cloud-deployment.md)
- [GitHub Actions deploy workflow](../.github/workflows/ci.yml)
- [Mastra Dockerfile](../mastra/Dockerfile)
- [Deployment guide](./deployments.md)
- [Upstash provisioning script](../scripts/provision-upstash.sh)
- [Supabase migrations directory](../supabase/migrations/)
- [Architecture notes mentioning deployment split](./system-architecture.md)

## Reviewer Shortcut

If a reviewer only checks three files, these are the strongest ones:

1. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) for automatic deploy-on-push of Supabase functions.
2. [`mastra/Dockerfile`](../mastra/Dockerfile) for containerized production deployment to Railway.
3. [`scripts/provision-upstash.sh`](../scripts/provision-upstash.sh) for scripted cloud resource provisioning.
