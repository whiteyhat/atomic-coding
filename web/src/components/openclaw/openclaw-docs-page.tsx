"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { ApiError, getOpenClawSkillManifest } from "@/lib/api";
import {
  buildOpenClawFrontendManifest,
  OPENCLAW_BACKEND_UNAVAILABLE_MESSAGE,
} from "@/lib/openclaw";
import { DashboardLoading, DashboardStatusCard } from "@/components/dashboard/dashboard-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
    >
      <Copy className="size-4" />
      {copied ? copiedLabel : label}
    </Button>
  );
}

function getMethodBadgeClass(method: string) {
  switch (method) {
    case "GET":
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
    case "POST":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "PUT":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "DELETE":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

export function OpenClawDocsPage() {
  const t = useTranslations("openclaw");
  const tCommon = useTranslations("common");
  const { data: manifestState, error } = useSWR(
    "openclaw-skill-manifest",
    async () => {
      try {
        return {
          manifest: await getOpenClawSkillManifest(),
          routeMissing: false,
        };
      } catch (fetchError) {
        if (fetchError instanceof ApiError && fetchError.status === 404) {
          return {
            manifest: buildOpenClawFrontendManifest(),
            routeMissing: true,
          };
        }
        throw fetchError;
      }
    },
    {
      revalidateOnFocus: false,
    },
  );

  const manifest = manifestState?.manifest;
  const routeMissing = manifestState?.routeMissing ?? false;

  if (!manifest && !error) {
    return (
      <DashboardLoading
        title={t("loadingDocs")}
        description={t("loadingDocsDescription")}
      />
    );
  }

  if (error || !manifest) {
    return (
      <DashboardStatusCard
        title={t("unableToLoadDocs")}
        description={error instanceof Error ? error.message : tCommon("error")}
      />
    );
  }

  const claimPayloadExample = JSON.stringify(
    {
      name: "My OpenClaw Agent",
      description: "Owner-scoped runtime for Atomic Coding",
      agent_url: "https://openclaw.example.com",
      endpoint_url: "https://openclaw.example.com/webhooks/atomic",
      webhook_events: ["build:*", "warroom:*", "openclaw:test"],
    },
    null,
    2,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#4c1a1f_0%,#210b10_48%,#0d0407_100%)] px-4 py-5 text-stone-50 md:px-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            asChild
            className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/openclaw">
              <ArrowLeft className="size-4" />
              {t("backToOpenClaw")}
            </Link>
          </Button>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={manifest.skill_json_url} label={t("copySkillJson")} copiedLabel={tCommon("copied")} />
            <CopyButton value={manifest.skill_manifest_url} label={t("copyMarkdown")} copiedLabel={tCommon("copied")} />
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(135deg,rgba(65,20,28,0.98),rgba(25,8,12,0.94))] p-6 shadow-[0_30px_120px_rgba(24,8,10,0.38)] md:p-8">
          <Badge className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-rose-200">
            {t("docsTitle")}
          </Badge>
          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t("docsHeading")}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
            {t("docsDescription")}
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{t("workflow")}</p>
              <p className="mt-3 text-lg font-semibold text-white">{manifest.workflow}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{t("createSession")}</p>
              <p className="mt-3 break-all text-sm text-white">{manifest.create_session_path}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{t("claimTemplate")}</p>
              <p className="mt-3 break-all text-sm text-white">{manifest.claim_path_template}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{t("heartbeatUrl")}</p>
              <p className="mt-3 break-all text-sm text-white">{manifest.heartbeat_url}</p>
            </div>
          </div>
        </section>

        {routeMissing ? (
          <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {OPENCLAW_BACKEND_UNAVAILABLE_MESSAGE} This page is showing the local contract fallback from the frontend codebase.
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_24px_90px_rgba(24,8,10,0.24)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{t("quickstart")}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{t("importSequence")}</h2>
            <div className="mt-5 space-y-3">
              {[
                t("importStep1"),
                t("importStep2"),
                t("importStep3"),
                t("importStep4"),
                t("importStep5"),
              ].map((step, index) => (
                <div key={step} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-sm font-semibold text-rose-200">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-white/65">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_24px_90px_rgba(24,8,10,0.24)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{t("claimPayload")}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{t("postBodyExample")}</h2>
            <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/8 bg-[#1b0a0e] p-4 text-sm leading-7 text-white/80">
              {claimPayloadExample}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={claimPayloadExample} label={t("copyPayload")} copiedLabel={tCommon("copied")} />
              <Button
                type="button"
                variant="outline"
                asChild
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <a href={manifest.docs_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {t("openManifestEndpoint")}
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_24px_90px_rgba(24,8,10,0.24)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{t("capabilities")}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{t("ownerControlSurface")}</h2>
            <div className="mt-5 space-y-3">
              {manifest.capabilities.map((group) => (
                <div key={group.key} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{group.label}</p>
                      <p className="mt-1 text-sm text-white/55">{group.description}</p>
                    </div>
                    <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                      {group.operations.length} ops
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {group.operations.map((operation) => (
                      <div key={`${group.key}-${operation.method}-${operation.path}`} className="rounded-[1rem] border border-white/8 bg-[#1c0b0f] px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("rounded-full border px-3 py-1", getMethodBadgeClass(operation.method))}>
                            {operation.method}
                          </Badge>
                          <span className="text-xs text-white/75">{operation.path}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-white/50">{operation.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_24px_90px_rgba(24,8,10,0.24)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{t("webhookEvents")}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{t("outboundNotifications")}</h2>
              <div className="mt-5 space-y-3">
                {manifest.webhook_events.map((event) => (
                  <div key={event.key} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{event.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/35">{event.key}</p>
                        <p className="mt-2 text-sm leading-6 text-white/55">{event.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_24px_90px_rgba(24,8,10,0.24)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{t("scopes")}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{t("defaultKeyScopes")}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {manifest.scopes.map((scope) => (
                  <Badge
                    key={scope}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/75"
                  >
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
