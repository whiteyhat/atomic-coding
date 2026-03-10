"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  Replace,
  Send,
  Sparkles,
  Webhook,
} from "lucide-react";
import {
  ApiError,
  cancelOpenClawOnboardingSession,
  createOpenClawApiKey,
  createOpenClawOnboarding,
  getOpenClawActivity,
  getOpenClawAgent,
  getOpenClawApiKeys,
  getOpenClawHealthScore,
  getOpenClawOnboardingSession,
  getOpenClawWebhookConfig,
  getOpenClawWebhookLog,
  replaceOpenClawAgent,
  revokeOpenClawApiKey,
  rotateOpenClawApiKey,
  testOpenClawConnection,
  testOpenClawWebhook,
  updateOpenClawWebhookConfig,
} from "@/lib/api";
import { getDashboardDisplayName } from "@/lib/dashboard";
import {
  buildOpenClawFallbackEnvelope,
  buildOpenClawClaimPrompt,
  clearStoredOpenClawSessionSnapshot,
  mergeOpenClawOnboardingSession,
  OPENCLAW_BACKEND_UNAVAILABLE_MESSAGE,
  readStoredOpenClawSessionSnapshot,
  formatOpenClawRelativeTime,
  formatOpenClawTimeRemaining,
  getOpenClawWizardStep,
  OPENCLAW_SESSION_STORAGE_KEY,
  OPENCLAW_WIZARD_STEPS,
  writeStoredOpenClawSessionSnapshot,
} from "@/lib/openclaw";
import { useAppAuth } from "@/lib/privy-provider";
import type {
  OpenClawAgent,
  OpenClawApiKeySecret,
  OpenClawOnboardingSession,
  OpenClawWebhookConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStatusCard } from "@/components/dashboard/dashboard-loading";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { OpenClawShellSkeleton } from "@/components/openclaw/openclaw-shell-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
}

function getConnectionBadgeClass(status: OpenClawAgent["connection_status"] | undefined) {
  switch (status) {
    case "connected":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "disconnected":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "error":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
    case "replaced":
      return "border-white/15 bg-white/8 text-white/65";
    case "pending":
    default:
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }
}

function getHealthBadgeClass(status: string | undefined) {
  switch (status) {
    case "healthy":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "degraded":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "critical":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/15 bg-white/8 text-white/65";
  }
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
      return "border-white/15 bg-white/8 text-white/70";
  }
}

function getSessionBadgeClass(status: OpenClawOnboardingSession["status"] | undefined) {
  switch (status) {
    case "claimed":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "expired":
    case "failed":
    case "cancelled":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
    case "pending_claim":
    default:
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
}

function toggleWebhookEvent(current: string[], eventKey: string) {
  if (eventKey === "*") {
    return ["*"];
  }

  const next = current.filter((value) => value !== "*");
  if (next.includes(eventKey)) {
    const filtered = next.filter((value) => value !== eventKey);
    return filtered.length > 0 ? filtered : ["*"];
  }

  return [...next, eventKey];
}

const DEFAULT_WEBHOOK_CONFIG: OpenClawWebhookConfig = {
  delivery_channel: "telegram",
  endpoint_url: null,
  telegram_bot_token: null,
  telegram_chat_id: null,
  webhook_events: ["*"],
};

function Panel({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/8 bg-[#251015]/95 p-5 shadow-[0_24px_80px_rgba(24,8,10,0.22)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  badge,
  badgeClassName,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</p>
        {badge ? (
          <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px]", badgeClassName)}>
            {badge}
          </Badge>
        ) : null}
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm leading-6 text-white/55">{hint}</p>
    </div>
  );
}

function StepRail({
  currentStep,
  session,
}: {
  currentStep: number;
  session: OpenClawOnboardingSession | null | undefined;
}) {
  return (
    <div className="space-y-3">
      {OPENCLAW_WIZARD_STEPS.map((label, index) => {
        const active = currentStep === index;
        const complete = currentStep > index || session?.status === "claimed";
        return (
          <div
            key={label}
            className={cn(
              "rounded-[1.3rem] border px-4 py-3 transition-colors",
              active ? "border-rose-400/22 bg-rose-400/10" : "border-white/8 bg-white/[0.02]",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                  complete
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                    : active
                      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
                      : "border-white/10 bg-white/5 text-white/55",
                )}
              >
                {complete ? <CheckCircle2 className="size-4" /> : index + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="mt-1 text-xs text-white/45">
                  {index === 0
                    ? "Create a one-time claim URL."
                    : index === 1
                      ? "Paste the handoff into OpenClaw."
                      : "Atomic swaps to the claimed runtime."}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
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
      {copied ? "Copied" : label}
    </Button>
  );
}

export function OpenClawShell() {
  const router = useRouter();
  const { user, ready, authenticated } = useAppAuth();
  const [hasResolvedInitialAgentState, setHasResolvedInitialAgentState] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const storedSnapshot = readStoredOpenClawSessionSnapshot();
    return window.localStorage.getItem(OPENCLAW_SESSION_STORAGE_KEY) ?? storedSnapshot?.session_id ?? null;
  });
  const [sessionSeed, setSessionSeed] = useState<OpenClawOnboardingSession | null>(() => readStoredOpenClawSessionSnapshot());
  const [revealedKey, setRevealedKey] = useState<OpenClawApiKeySecret | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webhookDraft, setWebhookDraft] = useState<OpenClawWebhookConfig | null>(null);
  const [isSessionPending, setIsSessionPending] = useState(false);
  const [isConnectionPending, setIsConnectionPending] = useState(false);
  const [isKeyPending, setIsKeyPending] = useState(false);
  const [isWebhookPending, setIsWebhookPending] = useState(false);

  const shouldLoad = ready && authenticated && !!user?.id;

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login?redirect=/openclaw");
    }
  }, [authenticated, ready, router]);

  const {
    data: agentState,
    error: agentError,
    isLoading: isAgentLoading,
    mutate: mutateAgent,
  } = useSWR(
    shouldLoad ? "openclaw-agent" : null,
    async () => {
      try {
        return {
          envelope: await getOpenClawAgent(),
          routeMissing: false,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return {
            envelope: buildOpenClawFallbackEnvelope(),
            routeMissing: true,
          };
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (agentState || agentError) {
      setHasResolvedInitialAgentState(true);
    }
  }, [agentError, agentState]);

  useSWR(
    shouldLoad && sessionId ? ["openclaw-onboarding", sessionId] : null,
    ([, nextSessionId]) => getOpenClawOnboardingSession(nextSessionId),
    {
      revalidateOnFocus: false,
      refreshInterval: sessionSeed?.status === "pending_claim" ? 1500 : 0,
      onSuccess: (data) => {
        setSessionSeed((current) => {
          const merged = mergeOpenClawOnboardingSession(current, data);
          writeStoredOpenClawSessionSnapshot(merged);
          return merged;
        });
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("not found") && typeof window !== "undefined") {
          window.localStorage.removeItem(OPENCLAW_SESSION_STORAGE_KEY);
          clearStoredOpenClawSessionSnapshot();
          setSessionId(null);
          setSessionSeed(null);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to refresh the OpenClaw onboarding session.",
        );
      },
    },
  );

  const activeSession = sessionSeed;
  const agentEnvelope = agentState?.envelope;
  const openClawRouteMissing = agentState?.routeMissing ?? false;
  const showWizard =
    !agentEnvelope?.agent ||
    (activeSession != null && activeSession.status !== "claimed");

  const { data: health, mutate: mutateHealth } = useSWR(
    shouldLoad && agentEnvelope?.agent && !showWizard ? "openclaw-health" : null,
    getOpenClawHealthScore,
    { revalidateOnFocus: false },
  );

  const { data: apiKeys, mutate: mutateApiKeys } = useSWR(
    shouldLoad && agentEnvelope?.agent && !showWizard ? "openclaw-api-keys" : null,
    getOpenClawApiKeys,
    { revalidateOnFocus: false },
  );

  const { data: activity, mutate: mutateActivity } = useSWR(
    shouldLoad && agentEnvelope?.agent && !showWizard ? "openclaw-activity" : null,
    () => getOpenClawActivity(12, 0),
    { revalidateOnFocus: false },
  );

  const { data: webhookConfig, mutate: mutateWebhookConfig } = useSWR(
    shouldLoad && agentEnvelope?.agent && !showWizard ? "openclaw-webhook-config" : null,
    getOpenClawWebhookConfig,
    { revalidateOnFocus: false },
  );

  const { data: webhookLog, mutate: mutateWebhookLog } = useSWR(
    shouldLoad && agentEnvelope?.agent && !showWizard ? "openclaw-webhook-log" : null,
    () => getOpenClawWebhookLog(6),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (activeSession?.status !== "claimed") {
      return;
    }

    void mutateAgent();
  }, [activeSession?.status, mutateAgent]);

  useEffect(() => {
    if (activeSession?.status !== "claimed" || typeof window === "undefined" || !agentEnvelope?.agent) {
      return;
    }

    window.localStorage.removeItem(OPENCLAW_SESSION_STORAGE_KEY);
    clearStoredOpenClawSessionSnapshot();
    setSessionId(null);
    setSessionSeed(null);

    void mutateHealth();
    void mutateApiKeys();
    void mutateActivity();
    void mutateWebhookConfig();
    void mutateWebhookLog();
  }, [
    activeSession?.status,
    agentEnvelope?.agent,
    mutateActivity,
    mutateApiKeys,
    mutateHealth,
    mutateWebhookConfig,
    mutateWebhookLog,
  ]);

  if (!ready || (ready && !authenticated)) {
    return <OpenClawShellSkeleton />;
  }

  if (!hasResolvedInitialAgentState && isAgentLoading && !agentEnvelope) {
    return <OpenClawShellSkeleton />;
  }

  if (agentError && !agentEnvelope) {
    return (
      <DashboardStatusCard
        title="Unable to load OpenClaw"
        description={agentError instanceof Error ? agentError.message : "The OpenClaw request failed."}
        action={
          <Button type="button" onClick={() => void mutateAgent()}>
            Retry
          </Button>
        }
      />
    );
  }

  const displayName = getDashboardDisplayName({
    id: user?.id ?? "",
    displayName: null,
    email: user?.email?.address ?? null,
    walletAddress: user?.wallet?.address ?? null,
    avatarUrl: null,
  });
  const agent = agentEnvelope?.agent ?? null;
  const currentStep = getOpenClawWizardStep(activeSession);
  const latestKey = apiKeys?.find((key) => key.active) ?? apiKeys?.[0] ?? null;
  const resolvedWebhookConfig = webhookDraft ?? webhookConfig ?? DEFAULT_WEBHOOK_CONFIG;
  const webhookDeliveryChannel = resolvedWebhookConfig.delivery_channel;
  const webhookEndpoint = resolvedWebhookConfig.endpoint_url ?? "";
  const telegramBotToken = resolvedWebhookConfig.telegram_bot_token ?? "";
  const telegramChatId = resolvedWebhookConfig.telegram_chat_id ?? "";
  const webhookEvents =
    resolvedWebhookConfig.webhook_events.length > 0
      ? resolvedWebhookConfig.webhook_events
      : ["*"];
  const capabilityLabels = agentEnvelope?.capabilities.map((group) => group.label) ?? [];
  const claimPrompt = activeSession ? buildOpenClawClaimPrompt(activeSession) : "";
  const isHandshakeActivating =
    activeSession?.status === "claimed" && !agentEnvelope?.agent;

  function storeSession(nextSession: OpenClawOnboardingSession) {
    setSessionSeed(nextSession);
    setSessionId(nextSession.session_id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OPENCLAW_SESSION_STORAGE_KEY, nextSession.session_id);
    }
    writeStoredOpenClawSessionSnapshot(nextSession);
  }

  function resetOpenClawHandshakeState() {
    clearStoredOpenClawSessionSnapshot();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(OPENCLAW_SESSION_STORAGE_KEY);
    }
    setSessionId(null);
    setSessionSeed(null);
    setErrorMessage(null);
    setNotice(null);
  }

  function patchWebhookDraft(patch: Partial<OpenClawWebhookConfig>) {
    setWebhookDraft({
      ...resolvedWebhookConfig,
      ...patch,
    });
  }

  async function handleStartSession(mode: "import" | "replace") {
    if (isSessionPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setRevealedKey(null);
    setIsSessionPending(true);

    try {
      const nextSession =
        mode === "replace"
          ? await replaceOpenClawAgent()
          : await createOpenClawOnboarding();
      storeSession(nextSession);
      setNotice(
        mode === "replace"
          ? "Replacement session ready. Send the prompt to OpenClaw."
          : "Claim link generated. Send the prompt to OpenClaw to finish the import.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the OpenClaw onboarding session.",
      );
    } finally {
      setIsSessionPending(false);
    }
  }

  async function handleCancelSession() {
    if (!activeSession || isSessionPending) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this OpenClaw handshake? The current claim link will stop working and the wizard will reset.",
    );
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsSessionPending(true);

    try {
      if (activeSession.status === "pending_claim") {
        await cancelOpenClawOnboardingSession(activeSession.session_id);
      }
      resetOpenClawHandshakeState();
      await mutateAgent();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel the OpenClaw handshake.",
      );
    } finally {
      setIsSessionPending(false);
    }
  }

  async function handleRefreshConnection() {
    if (isConnectionPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsConnectionPending(true);

    try {
      await testOpenClawConnection();
      await Promise.all([mutateAgent(), mutateHealth()]);
      setNotice("Connection status refreshed.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refresh the OpenClaw connection.",
      );
    } finally {
      setIsConnectionPending(false);
    }
  }

  async function handleCreateKey() {
    if (isKeyPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsKeyPending(true);

    try {
      const result = await createOpenClawApiKey();
      setRevealedKey(result);
      await Promise.all([mutateApiKeys(), mutateAgent()]);
      setNotice("A new OpenClaw API key is ready. Copy it now; this is the only reveal.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the OpenClaw API key.",
      );
    } finally {
      setIsKeyPending(false);
    }
  }

  async function handleRotateKey(keyId: string) {
    if (isKeyPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsKeyPending(true);

    try {
      const result = await rotateOpenClawApiKey(keyId);
      setRevealedKey(result);
      await Promise.all([mutateApiKeys(), mutateAgent()]);
      setNotice("API key rotated. Copy the replacement key before leaving this page.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to rotate the OpenClaw API key.",
      );
    } finally {
      setIsKeyPending(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!window.confirm("Revoke this OpenClaw API key? Existing OpenClaw sessions using it will stop working.")) {
      return;
    }
    if (isKeyPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsKeyPending(true);

    try {
      await revokeOpenClawApiKey(keyId);
      await mutateApiKeys();
      setNotice("API key revoked.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to revoke the OpenClaw API key.",
      );
    } finally {
      setIsKeyPending(false);
    }
  }

  async function handleSaveWebhookConfig() {
    if (isWebhookPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsWebhookPending(true);

    try {
      const nextConfig: OpenClawWebhookConfig = {
        delivery_channel: webhookDeliveryChannel,
        endpoint_url: webhookEndpoint.trim() || null,
        telegram_bot_token: telegramBotToken.trim() || null,
        telegram_chat_id: telegramChatId.trim() || null,
        webhook_events: webhookEvents,
      };

      await updateOpenClawWebhookConfig({
        delivery_channel: nextConfig.delivery_channel,
        endpoint_url: nextConfig.endpoint_url,
        telegram_bot_token: nextConfig.telegram_bot_token,
        telegram_chat_id: nextConfig.telegram_chat_id,
        webhook_events: nextConfig.webhook_events,
      });
      setWebhookDraft(nextConfig);
      await Promise.all([mutateWebhookConfig(), mutateAgent()]);
      setNotice(
        webhookDeliveryChannel === "telegram"
          ? "Telegram delivery settings saved."
          : "Webhook settings saved.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the webhook settings.",
      );
    } finally {
      setIsWebhookPending(false);
    }
  }

  async function handleTestWebhook() {
    if (isWebhookPending) {
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsWebhookPending(true);

    try {
      const result = await testOpenClawWebhook();
      await mutateWebhookLog();
      setNotice(
        result.ok
          ? `${webhookDeliveryChannel === "telegram" ? "Telegram" : "Webhook"} test succeeded in ${result.latency_ms}ms.`
          : result.error ?? `${webhookDeliveryChannel === "telegram" ? "Telegram" : "Webhook"} test failed.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send the webhook test event.",
      );
    } finally {
      setIsWebhookPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#4c1a1f_0%,#210b10_48%,#0d0407_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex max-w-[1680px] gap-5">
        <DashboardSidebar />

        <main className="min-w-0 flex-1 space-y-5">
          <DashboardHeader displayName={displayName} />

          <section className="rounded-[1.9rem] border border-white/8 bg-[linear-gradient(135deg,rgba(65,20,28,0.96),rgba(24,8,12,0.94))] p-6 shadow-[0_26px_110px_rgba(24,8,10,0.34)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <Badge className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-rose-200">
                  OpenClaw
                </Badge>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-[2.55rem]">
                  {showWizard
                    ? agent
                      ? "Replace your imported OpenClaw agent"
                      : "Import your OpenClaw agent"
                    : "Manage your imported OpenClaw agent"}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62 md:text-base">
                  {showWizard
                    ? "Use the one-time claim flow to connect OpenClaw to Atomic. Once claimed, this page becomes the compact control surface for status, webhooks, and credentials."
                    : "Keep the connection healthy, manage the runtime key, and send webhook events from one place."}
                </p>
                {!showWizard && agent ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className={cn("rounded-full border px-3 py-1", getConnectionBadgeClass(agent.connection_status))}>
                      {agent.connection_status}
                    </Badge>
                    <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/75">
                      Claimed {formatOpenClawRelativeTime(agent.claimed_at)}
                    </Badge>
                    {health?.status ? (
                      <Badge className={cn("rounded-full border px-3 py-1", getHealthBadgeClass(health.status))}>
                        {health.status}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/openclaw/docs">
                    <ArrowUpRight className="size-4" />
                    Docs
                  </Link>
                </Button>

                {showWizard ? (
                  <Button
                    type="button"
                    onClick={() => { void handleStartSession(agent ? "replace" : "import"); }}
                    disabled={isSessionPending || openClawRouteMissing}
                    className="bg-rose-500 text-white hover:bg-rose-500/90"
                    aria-busy={isSessionPending}
                  >
                    {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {isSessionPending
                      ? agent
                        ? "Preparing replacement..."
                        : "Generating link..."
                      : openClawRouteMissing
                        ? "Deploy backend first"
                        : agent
                          ? "Start replace flow"
                          : "Generate claim link"}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { void handleRefreshConnection(); }}
                      disabled={isConnectionPending || openClawRouteMissing}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      aria-busy={isConnectionPending}
                    >
                      {isConnectionPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                      {isConnectionPending ? "Testing..." : "Test connection"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => { void handleStartSession("replace"); }}
                      disabled={isSessionPending || openClawRouteMissing}
                      className="bg-rose-500 text-white hover:bg-rose-500/90"
                      aria-busy={isSessionPending}
                    >
                      {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : <Replace className="size-4" />}
                      {isSessionPending ? "Preparing replacement..." : "Replace agent"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {(notice || errorMessage) && (
            <div
              className={cn(
                "rounded-[1.35rem] border px-4 py-3 text-sm",
                errorMessage
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
              )}
            >
              {errorMessage ?? notice}
            </div>
          )}

          {openClawRouteMissing ? (
            <div className="rounded-[1.35rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {OPENCLAW_BACKEND_UNAVAILABLE_MESSAGE}
            </div>
          ) : null}

          {showWizard ? (
            <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
              <Panel
                eyebrow="Import Steps"
                title="Three-step import"
                description="This mirrors the lighter Quantik flow: generate a claim link, send it to OpenClaw, then wait for Atomic to swap to the claimed runtime."
              >
                <StepRail currentStep={currentStep} session={activeSession} />
                <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/58">
                  Atomic polls the session automatically. If you are replacing an existing agent, the current one stays live until the new claim succeeds.
                </div>
              </Panel>

              <Panel
                eyebrow="Claim Session"
                title={
                  !activeSession
                    ? "Generate the one-time claim link"
                    : activeSession.status === "claimed"
                      ? isHandshakeActivating
                        ? "Activating imported agent"
                        : "Claim completed"
                      : activeSession.status === "expired"
                        ? "Claim session expired"
                        : "Send this to OpenClaw"
                }
                description={
                  !activeSession
                    ? "Start an import session to get a one-time claim URL and handoff block."
                    : activeSession.status === "claimed"
                      ? isHandshakeActivating
                        ? "OpenClaw has claimed the session. Atomic is finalizing the imported runtime and loading the management view."
                        : "OpenClaw has claimed the session. Atomic is switching this page to the manage view."
                      : "Paste the claim link or the full handoff block into OpenClaw settings."
                }
                action={
                  activeSession ? (
                    <div className="flex flex-wrap gap-2">
                      {activeSession.onboarding_url ? (
                        <CopyButton value={claimPrompt} label="Copy prompt" />
                      ) : null}
                      {activeSession.status !== "claimed" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { void handleCancelSession(); }}
                          disabled={isSessionPending}
                          className="border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15 hover:text-rose-100"
                        >
                          {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                          Cancel handshake
                        </Button>
                      ) : null}
                    </div>
                  ) : undefined
                }
              >
                {!activeSession ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-white/[0.03] p-6">
                    {isSessionPending ? (
                      <div className="flex items-center gap-3 text-sm text-white/70">
                        <LoaderCircle className="size-4 animate-spin text-rose-200" />
                        Creating a one-time claim link and persisting the local handoff snapshot.
                      </div>
                    ) : (
                      <p className="text-sm leading-7 text-white/60">
                        No active session yet. Generate a claim link, send it to OpenClaw, and Atomic will wait for the runtime identity.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isHandshakeActivating ? (
                      <div className="rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                            <LoaderCircle className="size-4 animate-spin" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">Handshake accepted</p>
                            <p className="mt-1 text-sm leading-6 text-white/60">
                              Atomic is creating the imported agent record, issuing credentials, and switching this page to the management dashboard.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("rounded-full border px-3 py-1", getSessionBadgeClass(activeSession.status))}>
                        {activeSession.status}
                      </Badge>
                      <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        {activeSession.mode === "replace" ? "Replace session" : "Import session"}
                      </Badge>
                      <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        {formatOpenClawTimeRemaining(activeSession.expires_at)}
                      </Badge>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Claim URL</p>
                        <p className="mt-3 break-all text-sm leading-6 text-white">
                          {activeSession.onboarding_url ?? "Unavailable"}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Current imported agent</p>
                        <p className="mt-3 text-sm font-medium text-white">
                          {agent?.name ?? "None yet"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/55">
                          {agent
                            ? "The current agent stays active until this claim completes."
                            : "Once OpenClaw claims the link, Atomic will activate it here."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="openclaw-claim-prompt" className="text-white/80">
                        Paste this handoff into OpenClaw
                      </Label>
                      <Textarea
                        id="openclaw-claim-prompt"
                        readOnly
                        value={claimPrompt}
                        className="min-h-[220px] border-white/10 bg-[#1b0a0e] text-white"
                      />
                    </div>

                    {activeSession.identity ? (
                      <div className="rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/75">Claimed identity</p>
                        <div className="mt-3 flex items-start gap-3">
                          <div className="flex size-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-lg">
                            {activeSession.identity.avatar}
                          </div>
                          <div>
                            <p className="text-base font-semibold text-white">{activeSession.identity.name}</p>
                            <p className="mt-1 text-sm leading-6 text-white/60">
                              {activeSession.identity.description ?? "No description provided by OpenClaw."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeSession.last_error ? (
                      <div className="rounded-[1.25rem] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                        {activeSession.last_error}
                      </div>
                    ) : null}
                  </div>
                )}
              </Panel>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Connection"
                  value={agent?.connection_status ?? "pending"}
                  hint={agent?.last_error ?? "No runtime errors reported."}
                  badge={agent?.connection_status ?? "pending"}
                  badgeClassName={getConnectionBadgeClass(agent?.connection_status)}
                />
                <StatCard
                  label="Heartbeat"
                  value={agent?.last_heartbeat ? formatOpenClawRelativeTime(agent.last_heartbeat) : "Waiting"}
                  hint={formatTimestamp(agent?.last_heartbeat)}
                />
                <StatCard
                  label="24h Health"
                  value={health?.grade ?? "--"}
                  hint={
                    health
                      ? `${health.total_requests_24h} requests, ${health.error_count_24h} errors, ${health.avg_latency_ms ?? "--"}ms avg latency`
                      : "Telemetry will appear after OpenClaw starts sending traffic."
                  }
                  badge={health?.status ?? "insufficient_data"}
                  badgeClassName={getHealthBadgeClass(health?.status)}
                />
                <StatCard
                  label="Primary Key"
                  value={latestKey?.key_prefix ?? "Not issued"}
                  hint={
                    latestKey?.last_used_at
                      ? `Last used ${formatOpenClawRelativeTime(latestKey.last_used_at)}`
                      : "Issue or rotate a runtime key from this page."
                  }
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Panel
                  eyebrow="Connection Setup"
                  title="Delivery and runtime connection"
                  description="Choose where Atomic sends OpenClaw updates, then keep only the events you want enabled."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { void handleRefreshConnection(); }}
                        disabled={isConnectionPending || openClawRouteMissing}
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        aria-busy={isConnectionPending}
                      >
                        {isConnectionPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                        {isConnectionPending ? "Testing..." : "Test connection"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { void handleTestWebhook(); }}
                        disabled={isWebhookPending || openClawRouteMissing}
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        aria-busy={isWebhookPending}
                      >
                        {isWebhookPending ? <LoaderCircle className="size-4 animate-spin" /> : <Webhook className="size-4" />}
                        {isWebhookPending ? "Sending..." : webhookDeliveryChannel === "telegram" ? "Send Telegram test" : "Send test"}
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-5">
                    <div className="space-y-4">
                      <div
                        role="tablist"
                        aria-label="Delivery channel"
                        className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-1.5 sm:grid-cols-2"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={webhookDeliveryChannel === "telegram"}
                          onClick={() =>
                            patchWebhookDraft({
                              delivery_channel: "telegram",
                            })
                          }
                          className={cn(
                            "flex min-h-[4.5rem] w-full items-center gap-3 rounded-[0.95rem] border px-4 py-3 text-left transition-all",
                            webhookDeliveryChannel === "telegram"
                              ? "border-rose-300/24 bg-[linear-gradient(135deg,rgba(251,113,133,0.34),rgba(244,63,94,0.18))] text-white shadow-[0_16px_38px_rgba(244,63,94,0.18)]"
                              : "border-transparent bg-transparent text-white/62 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full border transition-colors",
                              webhookDeliveryChannel === "telegram"
                                ? "border-white/18 bg-white/14 text-white"
                                : "border-white/10 bg-white/[0.03] text-white/72",
                            )}
                          >
                            <Send className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">Telegram</p>
                            <p className="mt-1 text-xs leading-5 text-white/70">
                              Fast bot updates to one chat.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          role="tab"
                          aria-selected={webhookDeliveryChannel === "custom"}
                          onClick={() =>
                            patchWebhookDraft({
                              delivery_channel: "custom",
                            })
                          }
                          className={cn(
                            "flex min-h-[4.5rem] w-full items-center gap-3 rounded-[0.95rem] border px-4 py-3 text-left transition-all",
                            webhookDeliveryChannel === "custom"
                              ? "border-rose-300/24 bg-[linear-gradient(135deg,rgba(251,113,133,0.34),rgba(244,63,94,0.18))] text-white shadow-[0_16px_38px_rgba(244,63,94,0.18)]"
                              : "border-transparent bg-transparent text-white/62 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full border transition-colors",
                              webhookDeliveryChannel === "custom"
                                ? "border-white/18 bg-white/14 text-white"
                                : "border-white/10 bg-white/[0.03] text-white/72",
                            )}
                          >
                            <Webhook className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">Custom webhook</p>
                            <p className="mt-1 text-xs leading-5 text-white/70">
                              Signed JSON posts to your endpoint.
                            </p>
                          </div>
                        </button>
                      </div>

                      <div className="rounded-[1.15rem] border border-rose-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {webhookDeliveryChannel === "telegram" ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm font-medium text-white">Telegram delivery</p>
                              <p className="mt-1 text-xs leading-5 text-white/48">
                                Atomic sends subscribed events through your Telegram bot.
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="openclaw-telegram-token" className="text-white/80">
                                  Bot token
                                </Label>
                                <Input
                                  id="openclaw-telegram-token"
                                  type="password"
                                  value={telegramBotToken}
                                  onChange={(event) =>
                                    patchWebhookDraft({
                                      telegram_bot_token: event.target.value || null,
                                    })
                                  }
                                  placeholder="123456789:AA..."
                                  className="border-white/10 bg-[#1b0a0e] text-white placeholder:text-white/35"
                                />
                                <p className="text-xs leading-5 text-white/45">
                                  Leave blank to keep the existing token if one is already saved.
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="openclaw-telegram-chat-id" className="text-white/80">
                                  Chat ID
                                </Label>
                                <Input
                                  id="openclaw-telegram-chat-id"
                                  value={telegramChatId}
                                  onChange={(event) =>
                                    patchWebhookDraft({
                                      telegram_chat_id: event.target.value || null,
                                    })
                                  }
                                  placeholder="-1001234567890"
                                  className="border-white/10 bg-[#1b0a0e] text-white placeholder:text-white/35"
                                />
                                <p className="text-xs leading-5 text-white/45">
                                  Atomic sends each subscribed event as a bot message to this chat.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-white">Custom webhook delivery</p>
                            <p className="text-xs leading-5 text-white/48">
                              Atomic posts signed JSON event payloads to your own runtime.
                            </p>
                            <Label htmlFor="openclaw-webhook-url" className="pt-1 text-white/80">
                              Webhook endpoint
                            </Label>
                            <Input
                              id="openclaw-webhook-url"
                              type="url"
                              value={webhookEndpoint}
                              onChange={(event) =>
                                patchWebhookDraft({
                                  endpoint_url: event.target.value || null,
                                })
                              }
                              placeholder="https://openclaw.example.com/webhook"
                              className="border-white/10 bg-[#1b0a0e] text-white placeholder:text-white/35"
                            />
                            <p className="text-xs leading-5 text-white/45">
                              Atomic will POST signed JSON events to this URL.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={() => { void handleSaveWebhookConfig(); }}
                        disabled={isWebhookPending || openClawRouteMissing}
                        className="bg-rose-500 text-white hover:bg-rose-500/90"
                        aria-busy={isWebhookPending}
                      >
                        {isWebhookPending ? <LoaderCircle className="size-4 animate-spin" /> : <Webhook className="size-4" />}
                        {isWebhookPending ? "Saving..." : webhookDeliveryChannel === "telegram" ? "Save Telegram" : "Save webhook"}
                      </Button>
                    </div>

                    <div className="space-y-3 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-white/80">Event subscriptions</Label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {agentEnvelope?.webhook_events.map((event) => {
                          const selected = webhookEvents.includes(event.key);
                          return (
                            <button
                              key={event.key}
                              type="button"
                              onClick={() =>
                                patchWebhookDraft({
                                  webhook_events: toggleWebhookEvent(webhookEvents, event.key),
                                })
                              }
                              className={cn(
                                "rounded-[1.15rem] border p-3 text-left transition-colors",
                                selected
                                  ? "border-rose-400/22 bg-rose-400/10"
                                  : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-white">{event.label}</p>
                                {selected ? (
                                  <Badge className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-200">
                                    On
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-white/50">{event.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Recent deliveries</p>
                      {(webhookLog ?? []).length === 0 ? (
                        <div className="rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-white/55">
                          No webhook deliveries yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {webhookLog?.map((delivery) => (
                            <div
                              key={`${delivery.event}-${delivery.created_at}`}
                              className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{delivery.event}</p>
                                  <p className="mt-1 text-xs text-white/48">{formatTimestamp(delivery.created_at)}</p>
                                </div>
                                <Badge
                                  className={cn(
                                    "rounded-full border px-3 py-1",
                                    delivery.error || (delivery.status_code ?? 500) >= 400
                                      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                                      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                                  )}
                                >
                                  {delivery.status_code ?? "ERR"}
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-white/55">{delivery.url}</p>
                              {delivery.error ? (
                                <p className="mt-2 text-xs leading-5 text-rose-200">{delivery.error}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>

                <div className="space-y-5">
                  <Panel
                    eyebrow="Runtime Contract"
                    title={agent?.name ?? "OpenClaw"}
                    description={agent?.description ?? "External owner-scoped runtime imported into Atomic Coding."}
                    action={
                      agent?.agent_url ? (
                        <Button
                          type="button"
                          variant="outline"
                          asChild
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        >
                          <a href={agent.agent_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" />
                            Open agent
                          </a>
                        </Button>
                      ) : undefined
                    }
                  >
                    <div className="space-y-3">
                      <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Tool API base</p>
                        <p className="mt-2 break-all text-sm text-white">{agentEnvelope?.api_base_url}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Heartbeat URL</p>
                        <p className="mt-2 break-all text-sm text-white">{agentEnvelope?.heartbeat_url}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Skill JSON</p>
                        <p className="mt-2 break-all text-sm text-white">{agentEnvelope?.skill_json_url}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agentEnvelope?.skill_manifest_url ? (
                          <CopyButton value={agentEnvelope.skill_manifest_url} label="Copy manifest" />
                        ) : null}
                        {agentEnvelope?.skill_json_url ? (
                          <CopyButton value={agentEnvelope.skill_json_url} label="Copy skill JSON" />
                        ) : null}
                      </div>
                      <div className="pt-1">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Capabilities</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {capabilityLabels.map((label) => (
                            <Badge
                              key={label}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Panel>

                  <Panel
                    eyebrow="API Key"
                    title="Runtime credentials"
                    description="Issue, rotate, or revoke the owner-scoped key OpenClaw uses."
                    action={
                      <Button
                        type="button"
                        onClick={() => { void handleCreateKey(); }}
                        disabled={isKeyPending || openClawRouteMissing}
                        className="bg-rose-500 text-white hover:bg-rose-500/90"
                        aria-busy={isKeyPending}
                      >
                        {isKeyPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                        {isKeyPending ? "Issuing..." : "Issue key"}
                      </Button>
                    }
                  >
                    <div className="space-y-3">
                      {revealedKey ? (
                        <div className="rounded-[1.15rem] border border-amber-400/20 bg-amber-400/10 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Copy now</p>
                          <p className="mt-2 break-all font-mono text-sm text-white">{revealedKey.api_key}</p>
                          <div className="mt-3">
                            <CopyButton value={revealedKey.api_key} label="Copy key" />
                          </div>
                        </div>
                      ) : null}

                      {(apiKeys ?? []).length === 0 ? (
                        <div className="rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-white/55">
                          No OpenClaw API keys exist yet.
                        </div>
                      ) : (
                        apiKeys?.map((key) => (
                          <div
                            key={key.id}
                            className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">{key.key_prefix}</p>
                                <p className="mt-1 text-xs text-white/48">
                                  Created {formatOpenClawRelativeTime(key.created_at)}
                                </p>
                              </div>
                              <Badge
                                className={cn(
                                  "rounded-full border px-3 py-1",
                                  key.active
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border-white/10 bg-white/5 text-white/65",
                                )}
                              >
                                {key.active ? "Active" : "Revoked"}
                              </Badge>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {key.scopes.map((scope) => (
                                <Badge
                                  key={`${key.id}-${scope}`}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/65"
                                >
                                  {scope}
                                </Badge>
                              ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!key.active || isKeyPending || openClawRouteMissing}
                                  onClick={() => { void handleRotateKey(key.id); }}
                                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                >
                                  {isKeyPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                                  {isKeyPending ? "Rotating..." : "Rotate"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!key.active || isKeyPending || openClawRouteMissing}
                                  onClick={() => { void handleRevokeKey(key.id); }}
                                  className="border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15 hover:text-rose-100"
                                >
                                  {isKeyPending ? "Working..." : "Revoke"}
                                </Button>
                              </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel
                    eyebrow="Replace Agent"
                    title="Swap the imported runtime"
                    description="Use the same simple claim flow when OpenClaw changes environment or ownership."
                  >
                    <Button
                      type="button"
                      onClick={() => { void handleStartSession("replace"); }}
                      disabled={isSessionPending || openClawRouteMissing}
                      className="w-full bg-rose-500 text-white hover:bg-rose-500/90"
                      aria-busy={isSessionPending}
                    >
                      {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : <Replace className="size-4" />}
                      {isSessionPending ? "Preparing replacement..." : "Start replacement flow"}
                    </Button>
                  </Panel>
                </div>
              </div>

              <Panel
                eyebrow="Recent Activity"
                title="Latest OpenClaw tool calls"
                description="The most recent owner-scoped requests recorded against the imported runtime."
              >
                {(activity?.entries ?? []).length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-white/55">
                    No OpenClaw calls recorded yet.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {activity?.entries.map((entry) => (
                      <div
                        key={`${entry.tool_name}-${entry.created_at}`}
                        className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{entry.tool_name}</p>
                            <p className="mt-1 text-xs text-white/48">{formatTimestamp(entry.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn("rounded-full border px-3 py-1", getMethodBadgeClass(entry.method))}>
                              {entry.method}
                            </Badge>
                            <Badge
                              className={cn(
                                "rounded-full border px-3 py-1",
                                entry.status_code >= 400
                                  ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                              )}
                            >
                              {entry.status_code}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/55">{entry.latency_ms}ms</p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
