"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Atom,
  ArrowUpRight,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/constants";
import { useAppAuth } from "@/lib/auth-provider";
import {
  getPlatformAidFallbackSuggestions,
  getPlatformAidIntro,
  getPlatformAidOpened,
  getPlatformAidPageId,
  getPlatformAidSessionId,
  isPlatformAidRoute,
  mergePlatformAidSuggestions,
  parsePlatformAidEvent,
  setPlatformAidOpened,
  type PlatformAidAction,
  type PlatformAidContextKind,
  type PlatformAidDoneEvent,
  type PlatformAidPageId,
  type PlatformAidTraceEvent,
} from "@/lib/platform-aid";
import { cn } from "@/lib/utils";

type PlatformAidMessage =
  | {
      id: number;
      role: "user";
      text: string;
    }
  | {
      id: number;
      role: "agent";
      text: string;
      latencyMs?: number;
      model?: string;
    }
  | {
      id: number;
      role: "trace";
      trace: PlatformAidTraceEvent;
    }
  | {
      id: number;
      role: "context";
      kind: PlatformAidContextKind;
      data: unknown;
    };

interface DesktopPanelMetrics {
  bottom: number;
  left: number;
  top: number;
}

interface PlatformAidContextValue {
  available: boolean;
  currentPageId: PlatformAidPageId;
  hasBeenOpened: boolean;
  isSending: boolean;
  open: boolean;
  close: () => void;
  openPanel: () => void;
  toggle: () => void;
}

const PlatformAidContext = createContext<PlatformAidContextValue>({
  available: false,
  currentPageId: "other",
  hasBeenOpened: true,
  isSending: false,
  open: false,
  close: () => {},
  openPanel: () => {},
  toggle: () => {},
});

let nextMessageId = 0;

function getNextMessageId(): number {
  nextMessageId += 1;
  return nextMessageId;
}

function getDisplayName(
  user: ReturnType<typeof useAppAuth>["user"],
): string | null {
  if (!user) return null;
  const email = user.email?.address?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }

  return null;
}

function getContextHeading(kind: PlatformAidContextKind): string {
  switch (kind) {
    case "account":
      return "Account";
    case "games":
      return "Games";
    case "route":
      return "Route";
    default:
      return "OpenClaw";
  }
}

function getContextSummary(kind: PlatformAidContextKind, data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Context ready.";
  }

  if (kind === "account") {
    const account = data as {
      displayName?: string | null;
      email?: string | null;
      walletAddress?: string | null;
    };
    return (
      account.displayName ||
      account.email ||
      account.walletAddress ||
      "Signed-in creator context loaded."
    );
  }

  if (kind === "games") {
    const games = data as {
      totalCount?: number;
      publishedCount?: number;
      latestGame?: { name?: string; buildStatus?: string | null } | null;
    };
    const latestGame = games.latestGame?.name
      ? `${games.latestGame.name}${
          games.latestGame.buildStatus ? ` · ${games.latestGame.buildStatus}` : ""
        }`
      : "No games yet";
    return `${games.totalCount ?? 0} total · ${
      games.publishedCount ?? 0
    } published · ${latestGame}`;
  }

  if (kind === "route") {
    const route = data as {
      label?: string;
      summary?: string;
    };
    return route.summary ?? route.label ?? "Page context loaded.";
  }

  const openclaw = data as {
    hasAgent?: boolean;
    connectionStatus?: string | null;
    healthStatus?: string | null;
    healthScore?: number | null;
  };

  if (!openclaw.hasAgent) {
    return "No claimed OpenClaw agent yet.";
  }

  if (openclaw.healthScore != null) {
    return `${openclaw.connectionStatus ?? "pending"} · ${
      openclaw.healthStatus ?? "health pending"
    } · ${openclaw.healthScore}/100`;
  }

  return openclaw.connectionStatus ?? "OpenClaw context loaded.";
}

function getTraceTone(trace: PlatformAidTraceEvent): string {
  if (trace.state === "done") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }

  return "border-sky-400/20 bg-sky-400/10 text-sky-100";
}

function getDesktopPanelMetrics(): DesktopPanelMetrics | null {
  if (typeof window === "undefined") return null;

  const sidebar = document.querySelector<HTMLElement>(
    "[data-platform-aid-sidebar]",
  );
  if (!sidebar) return null;

  const rect = sidebar.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    left: Math.max(16, rect.right + 40),
    top: Math.max(16, rect.top),
    bottom: Math.max(16, window.innerHeight - rect.bottom),
  };
}

function SpeechBubble({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="absolute -top-16 left-3 animate-[bubble-pop_0.4s_ease-out] cursor-pointer whitespace-nowrap rounded-[1.2rem] border-2 border-cyan-200/40 bg-white px-3.5 py-2 text-[11px] font-bold tracking-wide text-slate-900 shadow-[3px_3px_0px_rgba(0,0,0,0.25)] transition-transform hover:scale-105"
      style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive" }}
      onClick={onDismiss}
    >
      Hey pal! Drop me a message!
      <div className="absolute -bottom-2 left-4 size-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.18)]" />
      <div className="absolute -bottom-[11px] left-[15px] size-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-cyan-200/40" />
    </div>
  );
}

function TriggerButton({
  className,
  isFloating = false,
}: {
  className?: string;
  isFloating?: boolean;
}) {
  const { available, hasBeenOpened, open, toggle } = usePlatformAid();
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  if (!available) return null;

  const pulsing = !hasBeenOpened;
  const showBubble = pulsing && !open && !bubbleDismissed;

  function handleToggle() {
    setBubbleDismissed(true);
    toggle();
  }

  return (
    <div className={cn("relative", className, !isFloating && "z-[61]")}>
      {showBubble ? <SpeechBubble onDismiss={handleToggle} /> : null}

      {pulsing ? (
        <div
          className={cn(
            "pointer-events-none absolute rounded-full border border-cyan-300/45",
            isFloating ? "-inset-2" : "-inset-2.5",
            "animate-[architecture-pulse-ring_1.7s_ease-out_infinite]",
          )}
        />
      ) : null}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={open ? "Close Atomic Aid Agent" : "Open Atomic Aid Agent"}
        className={cn(
          "relative flex items-center justify-center rounded-[1.1rem] border transition-all duration-200",
          open
            ? "border-cyan-300/35 bg-cyan-400/14 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)]"
            : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/24 hover:bg-white/[0.08] hover:text-white",
          isFloating ? "size-11" : "size-10",
          pulsing && !open && "animate-pulse",
        )}
      >
        <Atom
          className={cn(
            "size-4 transition-transform duration-300",
            open ? "rotate-90" : "rotate-0",
          )}
        />
      </button>
    </div>
  );
}

function PlatformAidMobileTrigger() {
  const { available } = usePlatformAid();

  if (!available) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[65] lg:hidden">
      <TriggerButton isFloating />
    </div>
  );
}

function PlatformAidSidebarPanel({
  actions,
  desktopPanelMetrics,
  input,
  messages,
  onAction,
  onClose,
  onInputChange,
  onSubmit,
  sending,
  suggestions,
}: {
  actions: PlatformAidAction[];
  desktopPanelMetrics: DesktopPanelMetrics | null;
  input: string;
  messages: PlatformAidMessage[];
  onAction: (href: string) => void;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => Promise<void>;
  sending: boolean;
  suggestions: string[];
}) {
  const { currentPageId, open } = usePlatformAid();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => textareaRef.current?.focus(), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void onSubmit(input);
  }

  const desktopPanelStyle = desktopPanelMetrics
    ? {
        left: `${desktopPanelMetrics.left}px`,
        top: `${desktopPanelMetrics.top}px`,
        bottom: `${desktopPanelMetrics.bottom}px`,
      }
    : undefined;

  // Safe left offset for lg screens when sidebar hasn't been measured yet.
  // Widest sidebar is 82px + page padding, so 130px clears it.
  const fallbackPanelStyle = !desktopPanelStyle
    ? { left: "130px", top: "16px", bottom: "16px" }
    : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Close Atomic Aid Agent"
        className={cn(
          "fixed inset-0 z-[59] bg-black/55 transition-opacity duration-200",
          "lg:rounded-[2rem] lg:bg-black/42",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={desktopPanelStyle ?? fallbackPanelStyle}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-full max-w-[420px] flex-col border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_42%),linear-gradient(180deg,#12070a_0%,#1a0b10_45%,#10060a_100%)] shadow-[0_24px_90px_rgba(0,0,0,0.45)] transition-transform duration-300 md:max-w-[440px] lg:rounded-[2rem] lg:border lg:border-white/8",
          open ? "translate-x-0" : "-translate-x-[200%]",
        )}
        style={desktopPanelStyle ?? fallbackPanelStyle}
      >
        <div className="border-b border-white/8 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
                <Sparkles className="size-3.5" />
                Atomic Aid Agent
              </div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Platform aid
              </h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-white/55">
                Route-aware help for onboarding, navigation, publishing,
                OpenClaw, and platform workflows.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/65">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            {currentPageId === "other"
              ? "Standby"
              : `Focused on ${currentPageId}`}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-white/55">
              Ask about where to start, how publishing works, what OpenClaw
              does, how War Room fits in, or where a feature lives.
            </div>
          ) : null}

          {messages.map((message) => {
            if (message.role === "trace" || message.role === "context") {
              return null;
            }

            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-[1.4rem] px-4 py-3 text-sm leading-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                    isUser
                      ? "bg-cyan-400/14 text-white border border-cyan-300/18"
                      : "border border-white/10 bg-[#1b0b10]/95 text-white/88",
                  )}
                >
                  <p>{message.text}</p>
                  {!isUser && (message.latencyMs || message.model) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/30">
                      {message.model ? <span>{message.model}</span> : null}
                      {message.latencyMs ? (
                        <span>{Math.round(message.latencyMs)} ms</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {sending ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[1.4rem] border border-white/10 bg-[#1b0b10]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                <span className="size-1.5 animate-[typing-dot_1.4s_ease-in-out_infinite] rounded-full bg-white/50" />
                <span className="size-1.5 animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite] rounded-full bg-white/50" />
                <span className="size-1.5 animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite] rounded-full bg-white/50" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/8 px-4 py-4">
          {actions.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={`${action.label}-${action.href}`}
                  type="button"
                  onClick={() => onAction(action.href)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-400/14"
                >
                  <ArrowUpRight className="size-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void onSubmit(suggestion)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-black/15 p-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Ask about the platform, onboarding, publishing, OpenClaw, or where something lives."
              className="min-h-[92px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm text-white outline-none placeholder:text-white/30"
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              <Button
                type="button"
                onClick={() => void onSubmit(input)}
                disabled={sending || !input.trim()}
                className="h-9 rounded-full bg-cyan-400/80 px-3 text-sm text-slate-950 hover:bg-cyan-300"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function PlatformAidProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { getAccessToken, user } = useAppAuth();
  const available = isPlatformAidRoute(pathname);
  const currentPageId = getPlatformAidPageId(pathname);
  const displayName = getDisplayName(user);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PlatformAidMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [actions, setActions] = useState<PlatformAidAction[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(
    getPlatformAidFallbackSuggestions(currentPageId),
  );
  const [sessionId, setSessionId] = useState("");
  const [hasBeenOpened, setHasBeenOpenedState] = useState(false);
  const [desktopPanelMetrics, setDesktopPanelMetrics] =
    useState<DesktopPanelMetrics | null>(null);

  const currentAgentMessageIdRef = useRef<number | null>(null);
  const activeTraceIdsRef = useRef<Record<string, number>>({});
  const activeContextIdsRef = useRef<
    Partial<Record<PlatformAidContextKind, number>>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(getPlatformAidSessionId(window.localStorage));
    setHasBeenOpenedState(getPlatformAidOpened(window.localStorage));
  }, []);

  useEffect(() => {
    if (!available) {
      setOpen(false);
      setDesktopPanelMetrics(null);
    }
  }, [available]);

  useEffect(() => {
    if (!available || typeof window === "undefined") return;

    const measure = () => {
      const next = getDesktopPanelMetrics();
      if (next) {
        setDesktopPanelMetrics(next);
      }
    };

    // Measure on initial render and after navigation
    const frameId = window.requestAnimationFrame(measure);

    // Re-measure when the sidebar element appears/disappears during navigation
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleResize = () => measure();
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [available, pathname]);

  useEffect(() => {
    setSuggestions((current) =>
      current.length > 0
        ? mergePlatformAidSuggestions(currentPageId, current)
        : getPlatformAidFallbackSuggestions(currentPageId),
    );
  }, [currentPageId]);

  useEffect(() => {
    if (!open || messages.length > 0) return;

    setMessages([
      {
        id: getNextMessageId(),
        role: "agent",
        text: getPlatformAidIntro(currentPageId, displayName),
      },
    ]);
  }, [currentPageId, displayName, messages.length, open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const resetTurnState = useCallback(() => {
    currentAgentMessageIdRef.current = null;
    activeTraceIdsRef.current = {};
    activeContextIdsRef.current = {};
  }, []);

  const applyContextEvent = useCallback(
    (kind: PlatformAidContextKind, data: unknown) => {
      const existingId = activeContextIdsRef.current[kind];
      if (existingId) {
        setMessages((current) =>
          current.map((message) =>
            message.role === "context" && message.id === existingId
              ? { ...message, data }
              : message,
          ),
        );
        return;
      }

      const nextId = getNextMessageId();
      activeContextIdsRef.current[kind] = nextId;
      setMessages((current) => [
        ...current,
        { id: nextId, role: "context", kind, data },
      ]);
    },
    [],
  );

  const handleParsedEvent = useCallback(
    (rawEvent: ReturnType<typeof parsePlatformAidEvent>) => {
      if (!rawEvent) return;

      if (rawEvent.type === "trace") {
        const existingId = activeTraceIdsRef.current[rawEvent.key];
        if (existingId) {
          setMessages((current) =>
            current.map((message) =>
              message.role === "trace" && message.id === existingId
                ? { ...message, trace: rawEvent }
                : message,
            ),
          );
          return;
        }

        const nextId = getNextMessageId();
        activeTraceIdsRef.current[rawEvent.key] = nextId;
        setMessages((current) => [
          ...current,
          { id: nextId, role: "trace", trace: rawEvent },
        ]);
        return;
      }

      if (rawEvent.type === "context") {
        applyContextEvent(rawEvent.kind, rawEvent.data);
        return;
      }

      if (rawEvent.type === "token") {
        if (currentAgentMessageIdRef.current == null) {
          const nextId = getNextMessageId();
          currentAgentMessageIdRef.current = nextId;
          setMessages((current) => [
            ...current,
            { id: nextId, role: "agent", text: rawEvent.token },
          ]);
          return;
        }

        setMessages((current) =>
          current.map((message) =>
            message.role === "agent" &&
            message.id === currentAgentMessageIdRef.current
              ? { ...message, text: message.text + rawEvent.token }
              : message,
          ),
        );
        return;
      }

      if (rawEvent.type === "done") {
        setSending(false);
        setSuggestions(
          mergePlatformAidSuggestions(currentPageId, rawEvent.suggestions),
        );
        setActions(rawEvent.actions ?? []);

        if (rawEvent.contexts) {
          for (const [kind, data] of Object.entries(rawEvent.contexts) as Array<
            [PlatformAidContextKind, unknown]
          >) {
            applyContextEvent(kind, data);
          }
        }

        if (currentAgentMessageIdRef.current != null) {
          setMessages((current) =>
            current.map((message) =>
              message.role === "agent" &&
              message.id === currentAgentMessageIdRef.current
                ? {
                    ...message,
                    text: rawEvent.reply || message.text,
                    latencyMs: rawEvent.latencyMs,
                    model: rawEvent.model,
                  }
                : message,
            ),
          );
          return;
        }

        if (rawEvent.reply) {
          const reply = rawEvent.reply;
          setMessages((current) => [
            ...current,
            {
              id: getNextMessageId(),
              role: "agent",
              text: reply,
              latencyMs: rawEvent.latencyMs,
              model: rawEvent.model,
            },
          ]);
        }
        return;
      }

      setSending(false);
      setActions([]);
      setMessages((current) => [
        ...current,
        {
          id: getNextMessageId(),
          role: "agent",
          text:
            rawEvent.error ??
            "Atomic Aid Agent is temporarily unavailable. Try again shortly.",
        },
      ]);
    },
    [applyContextEvent, currentPageId],
  );

  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || sending || !available) return;

      const localStorageRef =
        typeof window !== "undefined" ? window.localStorage : null;
      const resolvedSessionId =
        sessionId || getPlatformAidSessionId(localStorageRef);

      if (!sessionId) {
        setSessionId(resolvedSessionId);
      }

      resetTurnState();
      setSending(true);
      setOpen(true);
      setInput("");
      setActions([]);
      setSuggestions(getPlatformAidFallbackSuggestions(currentPageId));
      setMessages((current) => [
        ...current,
        { id: getNextMessageId(), role: "user", text: trimmed },
      ]);

      try {
        const token = await getAccessToken();
        const history = messages
          .filter(
            (entry): entry is Extract<
              PlatformAidMessage,
              { role: "user" | "agent" }
            > => entry.role === "user" || entry.role === "agent",
          )
          .slice(-16)
          .map((entry) => ({
            role: entry.role === "user" ? "user" : "assistant",
            content: entry.text,
          }));

        const response = await fetch(`${API_BASE}/assistant/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            sessionId: resolvedSessionId,
            history,
            clientContext: {
              pathname,
              pageId: currentPageId,
            },
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ??
              `Platform aid request failed (${response.status}).`,
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/event-stream") || !response.body) {
          const payload = (await response.json()) as PlatformAidDoneEvent;
          handleParsedEvent({
            type: "done",
            reply: payload.reply,
            latencyMs: payload.latencyMs,
            model: payload.model,
            suggestions: payload.suggestions,
            actions: payload.actions,
            contexts: payload.contexts,
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            handleParsedEvent(parsePlatformAidEvent(payload));
          }
        }

        setSending(false);
      } catch (error) {
        setSending(false);
        setMessages((current) => [
          ...current,
          {
            id: getNextMessageId(),
            role: "agent",
            text:
              error instanceof Error
                ? error.message
                : "Atomic Aid Agent is temporarily unavailable. Try again shortly.",
          },
        ]);
      }
    },
    [
      available,
      currentPageId,
      getAccessToken,
      handleParsedEvent,
      messages,
      pathname,
      resetTurnState,
      sending,
      sessionId,
    ],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    if (typeof window !== "undefined") {
      setPlatformAidOpened(window.localStorage, true);
    }
    setHasBeenOpenedState(true);
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
    if (typeof window !== "undefined") {
      setPlatformAidOpened(window.localStorage, true);
    }
    setHasBeenOpenedState(true);
  }, []);

  const handleAction = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const contextValue = useMemo<PlatformAidContextValue>(
    () => ({
      available,
      currentPageId,
      hasBeenOpened,
      isSending: sending,
      open,
      close,
      openPanel,
      toggle,
    }),
    [
      available,
      close,
      currentPageId,
      hasBeenOpened,
      open,
      openPanel,
      sending,
      toggle,
    ],
  );

  return (
    <PlatformAidContext.Provider value={contextValue}>
      {children}
      <PlatformAidMobileTrigger />
      {available ? (
        <PlatformAidSidebarPanel
          actions={actions}
          desktopPanelMetrics={desktopPanelMetrics}
          input={input}
          messages={messages}
          onAction={handleAction}
          onClose={close}
          onInputChange={setInput}
          onSubmit={sendMessage}
          sending={sending}
          suggestions={suggestions}
        />
      ) : null}
    </PlatformAidContext.Provider>
  );
}

export function usePlatformAid() {
  return useContext(PlatformAidContext);
}

export function PlatformAidSidebarTrigger() {
  const { available } = usePlatformAid();

  if (!available) return null;

  return <TriggerButton />;
}
