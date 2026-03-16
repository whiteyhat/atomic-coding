# Google Cloud Deployment Runbook

This guide shows the fastest honest way to run the current Atomic Coding architecture on Google Cloud.

## Important Reality Check

The current repository is not a pure Google Cloud-native system.

Today, the codebase depends on:

- Supabase for PostgreSQL, Storage, Realtime, and Edge Functions
- Upstash for Redis REST and QStash
- Clerk for auth
- OpenRouter and Buu as external APIs

So there are two different goals:

1. **Deploy the current architecture using Google Cloud for app hosting**
   - This is practical today.
   - `web` and `mastra` run on Google Cloud Run.
   - Images live in Artifact Registry.
   - Secrets live in Secret Manager.
   - Supabase remains the backend system of record.

2. **Move the entire platform to only Google Cloud services**
   - This is **not** a no-config deploy.
   - It requires real code changes because Supabase Realtime, Supabase Storage, Supabase Edge Functions, and Upstash are not drop-in Google Cloud equivalents.

This runbook focuses first on the deploy path that works with the repository **as it exists today**.

## Architecture Mapping

| Current subsystem | Google Cloud target | Status |
| --- | --- | --- |
| `web/` Next.js app | Cloud Run | Recommended now |
| `mastra/` Node orchestrator | Cloud Run | Recommended now |
| Container images | Artifact Registry | Recommended now |
| Runtime secrets | Secret Manager | Recommended now |
| Logs and metrics | Cloud Logging / Cloud Monitoring | Recommended now |
| Database, Storage, Realtime, Edge Functions | Keep existing Supabase project | Required for current codebase |
| Redis + QStash | Keep existing Upstash project | Required for current codebase |
| Auth | Keep Clerk | Required for current codebase |

## What “All Architecture On Google Cloud” Means For This Repo

If you want the shortest path to production, deploy this way:

- `web` on Cloud Run
- `mastra` on Cloud Run
- Supabase stays external
- Upstash stays external
- Clerk stays external

If you want a **100% GCP-native migration**, jump to [Full GCP-Native Migration Map](#full-gcp-native-migration-map) at the end of this file first. That is a migration project, not a deployment-only task.

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Supabase CLI installed
- Access to your current Supabase project secrets
- Access to your Clerk keys
- Access to your OpenRouter and Buu API keys

Helpful references:

- Cloud Run: <https://cloud.google.com/run/docs/deploying>
- Artifact Registry: <https://cloud.google.com/artifact-registry/docs/docker/store-docker-container-images>
- Secret Manager: <https://cloud.google.com/secret-manager/docs/create-secret-quickstart>
- Cloud Run secrets: <https://cloud.google.com/run/docs/configuring/services/secrets>
- Cloud SQL to Cloud Run: <https://cloud.google.com/sql/docs/postgres/connect-run>
- Clerk env vars: <https://clerk.com/docs/deployments/clerk-environment-variables>

## Step 1: Bootstrap The Google Cloud Project

Run this from your terminal and replace the placeholders before you execute it.

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export AR_REPO="atomic-coding"
export WEB_SERVICE="atomic-web"
export MASTRA_SERVICE="atomic-mastra"
export WEB_SA="atomic-web"
export MASTRA_SA="atomic-mastra"

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Atomic Coding container images" \
  2>/dev/null || true

gcloud iam service-accounts create "$WEB_SA" \
  --display-name="Atomic Coding web runtime" \
  2>/dev/null || true

gcloud iam service-accounts create "$MASTRA_SA" \
  --display-name="Atomic Coding mastra runtime" \
  2>/dev/null || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${WEB_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${MASTRA_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 2: Create Secret Manager Values For `mastra`

The `mastra` service is the easiest service to move first because the repo already contains a production Dockerfile at [`mastra/Dockerfile`](../mastra/Dockerfile).

Start with the minimum working secret set:

```bash
cat > /tmp/atomic-mastra.secrets.env <<'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key
OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image-preview
ALLOWED_ORIGINS=https://app.example.com,https://www.app.example.com
EOF
```

Create or update the secrets in Google Cloud:

```bash
while IFS='=' read -r name value; do
  [ -z "$name" ] && continue
  printf '%s' "$value" > "/tmp/${name}.secret"
  gcloud secrets create "$name" \
    --replication-policy=automatic \
    --data-file="/tmp/${name}.secret" \
    2>/dev/null || gcloud secrets versions add "$name" --data-file="/tmp/${name}.secret"
done < /tmp/atomic-mastra.secrets.env
```

Quick sanity check:

```bash
gcloud secrets list --format="value(name)" | rg 'SUPABASE_URL|OPENROUTER_API_KEY|ALLOWED_ORIGINS'
```

Optional follow-up secrets for `mastra`:

```bash
cat > /tmp/atomic-mastra.optional.env <<'EOF'
OPENROUTER_SITE_URL=https://app.example.com
OPENROUTER_APP_NAME=Atomic Coding Pixel
BUU_API_KEY=
BUU_API_URL=https://dev.api.buu.fun
SENTRY_DSN=
AXIOM_INGEST_URL=
AXIOM_TOKEN=
EOF
```

Delete any optional line you do not plan to use before you run the upload loop.

If you want those optional values too, add them with the same loop:

```bash
while IFS='=' read -r name value; do
  [ -z "$name" ] && continue
  printf '%s' "$value" > "/tmp/${name}.secret"
  gcloud secrets create "$name" \
    --replication-policy=automatic \
    --data-file="/tmp/${name}.secret" \
    2>/dev/null || gcloud secrets versions add "$name" --data-file="/tmp/${name}.secret"
done < /tmp/atomic-mastra.optional.env
```

## Step 3: Build And Deploy `mastra` To Cloud Run

Build the image in Google Cloud Build using the checked-in Dockerfile:

```bash
export TAG="$(date +%Y%m%d-%H%M%S)"

gcloud builds submit ./mastra \
  --tag "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/mastra:${TAG}"
```

Deploy the service:

```bash
gcloud run deploy "$MASTRA_SERVICE" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/mastra:${TAG}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${MASTRA_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port 4500 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets SUPABASE_URL=SUPABASE_URL:latest \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest \
  --set-secrets OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest \
  --set-secrets OPENROUTER_IMAGE_MODEL=OPENROUTER_IMAGE_MODEL:latest \
  --set-secrets ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest
```

If you added optional secrets, update the service after the first successful deploy:

```bash
gcloud run services update "$MASTRA_SERVICE" \
  --region "$REGION" \
  --set-secrets OPENROUTER_SITE_URL=OPENROUTER_SITE_URL:latest \
  --set-secrets OPENROUTER_APP_NAME=OPENROUTER_APP_NAME:latest \
  --set-secrets BUU_API_KEY=BUU_API_KEY:latest \
  --set-secrets BUU_API_URL=BUU_API_URL:latest \
  --set-secrets SENTRY_DSN=SENTRY_DSN:latest \
  --set-secrets AXIOM_INGEST_URL=AXIOM_INGEST_URL:latest \
  --set-secrets AXIOM_TOKEN=AXIOM_TOKEN:latest
```

Capture the service URL and verify health:

```bash
export MASTRA_URL="$(gcloud run services describe "$MASTRA_SERVICE" \
  --region "$REGION" \
  --format='value(status.url)')"

echo "$MASTRA_URL"
curl -fsSL "${MASTRA_URL}/health"
```

Expected result:

- HTTP `200`
- JSON response with `status: "ok"`
- agent list including `jarvis`, `forge`, `pixel`, and `checker`

Repo proof for that health route:

- [`mastra/src/index.ts`](../mastra/src/index.ts)

## Step 4: Point Supabase Edge Functions At The New Cloud Run `mastra`

This repo still relies on Supabase Edge Functions. Those functions must know the public URL of the Cloud Run-hosted `mastra` service.

At minimum, update `MASTRA_SERVER_URL` in Supabase, then redeploy the functions.

```bash
export SUPABASE_ACCESS_TOKEN="your-supabase-access-token"
export SUPABASE_PROJECT_REF="your-project-ref"

supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" \
  MASTRA_SERVER_URL="$MASTRA_URL" \
  ALLOWED_ORIGINS="https://app.example.com,https://www.app.example.com"

supabase db push --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF"
```

If your Supabase functions already use more secrets in production, keep those in place. The GCP-specific change is the `MASTRA_SERVER_URL` handoff to Cloud Run.

Repo proof for this dependency:

- [`supabase/functions/warroom-orchestrator/index.ts`](../supabase/functions/warroom-orchestrator/index.ts)
- [`supabase/functions/api/index.ts`](../supabase/functions/api/index.ts)

## Step 5: Create A Cloud Run Dockerfile For `web`

The repo currently has a checked-in Dockerfile for `mastra`, but not for `web`.

The safest production path for Google Cloud is to containerize `web` explicitly instead of relying on buildpack guesswork.

Create a deployment-only Dockerfile:

```bash
cat > web/Dockerfile.cloudrun <<'EOF'
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "8080"]
EOF
```

Create a Cloud Build config that tells Google Cloud to use that Dockerfile:

```bash
cat > /tmp/cloudbuild.web.yaml <<'EOF'
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile.cloudrun
      - -t
      - $_IMAGE
      - .
images:
  - $_IMAGE
EOF
```

## Step 6: Create Secret Manager Values For `web`

The minimum working `web` service needs:

- public browser config for Supabase and Clerk
- server-side config for Clerk and `mastra`
- optional observability or fallback API values later

Create the env file after `MASTRA_URL` exists:

```bash
cat > /tmp/atomic-web.secrets.env <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
MASTRA_SERVER_URL=${MASTRA_URL}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
EOF
```

Upload those values into Secret Manager:

```bash
while IFS='=' read -r name value; do
  [ -z "$name" ] && continue
  printf '%s' "$value" > "/tmp/${name}.secret"
  gcloud secrets create "$name" \
    --replication-policy=automatic \
    --data-file="/tmp/${name}.secret" \
    2>/dev/null || gcloud secrets versions add "$name" --data-file="/tmp/${name}.secret"
done < /tmp/atomic-web.secrets.env
```

Important note:

- The current repo imports Clerk server helpers such as `auth()` and `clerkMiddleware()`.
- In practice, that means the deployed web app needs both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

Repo proof:

- [`web/src/lib/auth.ts`](../web/src/lib/auth.ts)
- [`web/src/middleware.ts`](../web/src/middleware.ts)
- [`web/src/app/api/health/route.ts`](../web/src/app/api/health/route.ts)

Optional follow-up secrets for `web`:

```bash
cat > /tmp/atomic-web.optional.env <<'EOF'
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_BUU_API_URL=https://dev.api.buu.fun
BUU_API_KEY=
EOF
```

Delete any optional line you do not plan to use before you run the upload loop.

Upload them the same way if you need them:

```bash
while IFS='=' read -r name value; do
  [ -z "$name" ] && continue
  printf '%s' "$value" > "/tmp/${name}.secret"
  gcloud secrets create "$name" \
    --replication-policy=automatic \
    --data-file="/tmp/${name}.secret" \
    2>/dev/null || gcloud secrets versions add "$name" --data-file="/tmp/${name}.secret"
done < /tmp/atomic-web.optional.env
```

## Step 7: Build And Deploy `web` To Cloud Run

Build the web image in Cloud Build:

```bash
export WEB_TAG="$(date +%Y%m%d-%H%M%S)"

gcloud builds submit ./web \
  --config /tmp/cloudbuild.web.yaml \
  --substitutions _IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/web:${WEB_TAG}"
```

Deploy the Cloud Run service:

```bash
gcloud run deploy "$WEB_SERVICE" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/web:${WEB_TAG}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${WEB_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port 8080 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest \
  --set-secrets NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest \
  --set-secrets SUPABASE_URL=SUPABASE_URL:latest \
  --set-secrets MASTRA_SERVER_URL=MASTRA_SERVER_URL:latest \
  --set-secrets NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:latest \
  --set-secrets CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest
```

If you added optional web secrets, update the service after the base deploy:

```bash
gcloud run services update "$WEB_SERVICE" \
  --region "$REGION" \
  --set-secrets NEXT_PUBLIC_SENTRY_DSN=NEXT_PUBLIC_SENTRY_DSN:latest \
  --set-secrets NEXT_PUBLIC_BUU_API_URL=NEXT_PUBLIC_BUU_API_URL:latest \
  --set-secrets BUU_API_KEY=BUU_API_KEY:latest
```

Capture the URL:

```bash
export WEB_URL="$(gcloud run services describe "$WEB_SERVICE" \
  --region "$REGION" \
  --format='value(status.url)')"

echo "$WEB_URL"
```

## Step 8: Smoke Test The Full Deployment

The repo already exposes a web health route and a `mastra` health route. Use both.

```bash
curl -fsSL "${MASTRA_URL}/health"
curl -i "${WEB_URL}/api/health"
```

Expected web response:

- HTTP `200` if Supabase and `mastra` are reachable
- HTTP `503` if one of those checks fails

Then verify the real app flows manually:

1. Open `WEB_URL`
2. Sign in through Clerk
3. Open a workspace
4. Start a chat request
5. Create a war room
6. Confirm the web app can reach `mastra`
7. Confirm the Supabase-backed workflow still completes

Useful debugging commands:

```bash
gcloud run services logs read "$MASTRA_SERVICE" --region "$REGION" --limit=100
gcloud run services logs read "$WEB_SERVICE" --region "$REGION" --limit=100
```

## Step 9: Update External Dashboard Configuration

This part is easy to miss.

After you have the final `WEB_URL`, update your external providers:

### Clerk

Add the Cloud Run web URL to the Clerk application configuration:

- allowed origins
- sign-in redirect URLs
- sign-up redirect URLs
- after-auth redirect URLs if you use them

### Supabase

If your Supabase project restricts origins or callback URLs, update them for the new web domain.

### Mastra CORS

Make sure the `ALLOWED_ORIGINS` value used by `mastra` includes the final public web origin.

If you add a custom domain later, rotate `ALLOWED_ORIGINS` and redeploy `mastra`.

## Step 10: Optional CI/CD For Google Cloud

If you want a fully automated Google Cloud deployment from GitHub Actions, use Workload Identity Federation instead of a long-lived JSON key.

This is not currently enabled in the repo, but this is the right pattern to add.

Example `mastra` deploy job:

```yaml
deploy-mastra-gcp:
  if: github.ref == 'refs/heads/master'
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@v4

    - uses: google-github-actions/auth@v3
      with:
        workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
        service_account: ${{ secrets.GCP_DEPLOYER_SA }}

    - name: Configure Docker auth
      run: gcloud auth configure-docker ${{ vars.GCP_REGION }}-docker.pkg.dev --quiet

    - name: Build mastra image
      run: |
        gcloud builds submit ./mastra \
          --tag "${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/${{ vars.GCP_AR_REPO }}/mastra:${{ github.sha }}"

    - uses: google-github-actions/deploy-cloudrun@v3
      with:
        service: atomic-mastra
        region: ${{ vars.GCP_REGION }}
        image: ${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/${{ vars.GCP_AR_REPO }}/mastra:${{ github.sha }}
```

If you add this, use a second job or workflow for `web`.

References:

- <https://github.com/google-github-actions/auth>
- <https://github.com/google-github-actions/deploy-cloudrun>

## Full GCP-Native Migration Map

If by “deploy all the architecture on Google Cloud” you mean “replace Supabase and Upstash too,” this is the real migration map.

| Current dependency | GCP replacement candidate | Why it is not drop-in |
| --- | --- | --- |
| Supabase Postgres | Cloud SQL for PostgreSQL | The current app also depends on Supabase REST and auth patterns |
| Supabase Storage | Cloud Storage | Bundle upload and retrieval code would need to change |
| Supabase Realtime | Custom realtime service, WebSockets on Cloud Run, or Pub/Sub-backed fanout | There is no direct Supabase Realtime equivalent |
| Supabase Edge Functions | Cloud Run services or Cloud Functions | The current deploy and runtime model assumes Supabase-hosted functions |
| Upstash Redis REST | Memorystore or self-managed Redis access layer | Current code and env shape expect Upstash REST tokens and URLs |
| Upstash QStash | Cloud Tasks or Pub/Sub | Retry and delivery semantics would need code changes |
| Supabase auth helpers | Clerk + custom backend validation on GCP | Existing Supabase function auth flow would need to move |

If you want to start that migration, the least risky order is:

1. Move `web` to Cloud Run
2. Move `mastra` to Cloud Run
3. Keep Supabase as the data plane until the app is stable
4. Replace Edge Functions with Cloud Run services one by one
5. Replace Realtime and Storage last, because those are the least drop-in parts

## Recommended Production Path

For this repository, the most pragmatic production setup is:

- Cloud Run for `web`
- Cloud Run for `mastra`
- Artifact Registry for images
- Secret Manager for env vars
- Cloud Logging / Monitoring for ops
- Existing Supabase project for DB, Storage, Realtime, and Edge Functions
- Existing Upstash project for Redis REST and QStash

That gives you a real Google Cloud deployment without pretending the Supabase-heavy parts are already portable.
