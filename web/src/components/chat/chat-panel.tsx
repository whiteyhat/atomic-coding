"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { useSWRConfig } from "swr";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { AssetModelDialog } from "./asset-model-dialog";
import { ToolCall } from "./tool-call";
import { Box, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_MODEL, MODELS } from "@/lib/constants";
import {
  createChatSession,
  getChatMessages,
  saveChatMessages,
} from "@/lib/api";
import { shouldLoadPersistedChatHistory } from "@/lib/chat-session-state";
import { getChatSessionsKey } from "@/lib/hooks/use-chat-sessions";
import type { AssetModel } from "@/lib/types";
import { useAppAuth } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  gameId: string;
  gameName: string;
  gameFormat: "2d" | "3d" | null;
  genre: string | null;
  sessionClientId: string;
  sessionId: string | null;
  initialPrompt?: string | null;
  onSessionReady?: (sessionId: string) => void;
}

export function ChatPanel({
  gameId,
  gameName,
  gameFormat,
  genre,
  sessionClientId,
  sessionId,
  initialPrompt,
  onSessionReady,
}: ChatPanelProps) {
  const shouldLoadHistory = shouldLoadPersistedChatHistory(sessionClientId, sessionId);
  const [persistedHistory, setPersistedHistory] = useState<{
    sessionId: string;
    messages: UIMessage[];
    savedCount: number;
  } | null>(null);

  useEffect(() => {
    if (!shouldLoadHistory || !sessionId || persistedHistory?.sessionId === sessionId) {
      return;
    }

    let cancelled = false;
    getChatMessages(gameName, sessionId)
      .then((dbMessages) => {
        if (cancelled) return;
        const uiMessages: UIMessage[] = dbMessages.map((message) => ({
          id: message.message_id,
          role: message.role as "user" | "assistant",
          parts: message.parts as UIMessage["parts"],
        }));
        setPersistedHistory({
          sessionId,
          messages: uiMessages,
          savedCount: dbMessages.length,
        });
      })
      .catch((error) => {
        console.error("[chat] Failed to load messages:", error);
        if (cancelled) return;
        setPersistedHistory({
          sessionId,
          messages: [],
          savedCount: 0,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [gameName, persistedHistory?.sessionId, sessionId, shouldLoadHistory]);

  const initialMessages =
    shouldLoadHistory && persistedHistory?.sessionId !== sessionId
      ? null
      : persistedHistory?.messages ?? [];
  const initialSavedCount =
    shouldLoadHistory && persistedHistory?.sessionId === sessionId
      ? persistedHistory.savedCount
      : 0;

  if (initialMessages === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/45">
        Loading chat...
      </div>
    );
  }

  return (
    <PromptInputProvider initialInput={initialPrompt ?? ""}>
      <ChatPanelContent
        gameId={gameId}
        gameName={gameName}
        gameFormat={gameFormat}
        genre={genre}
        initialMessages={initialMessages}
        initialSavedCount={initialSavedCount}
        onSessionReady={onSessionReady}
        sessionClientId={sessionClientId}
        sessionId={sessionId}
      />
    </PromptInputProvider>
  );
}

interface ChatPanelContentProps {
  gameId: string;
  gameName: string;
  gameFormat: "2d" | "3d" | null;
  genre: string | null;
  initialMessages: UIMessage[];
  initialSavedCount: number;
  onSessionReady?: (sessionId: string) => void;
  sessionClientId: string;
  sessionId: string | null;
}

function ChatPanelContent({
  gameId,
  gameName,
  gameFormat,
  genre,
  initialMessages,
  initialSavedCount,
  onSessionReady,
  sessionClientId,
  sessionId,
}: ChatPanelContentProps) {
  const { getAccessToken } = useAppAuth();
  const { mutate } = useSWRConfig();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const modelRef = useRef(model);
  modelRef.current = model;

  const [selectedAssets, setSelectedAssets] = useState<AssetModel[]>([]);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const assetsRef = useRef<AssetModel[]>([]);
  assetsRef.current = selectedAssets;

  const [persistedSessionId, setPersistedSessionId] = useState(sessionId);
  const persistedSessionIdRef = useRef(persistedSessionId);
  persistedSessionIdRef.current = persistedSessionId;

  useEffect(() => {
    if (!sessionId) return;
    setPersistedSessionId((current) => current ?? sessionId);
  }, [sessionId]);

  const sessionCreatePromiseRef = useRef<Promise<string> | null>(null);
  const savedCountRef = useRef(initialSavedCount);
  const isPersistingRef = useRef(false);
  const tokenCacheRef = useRef<{ token: string | null; ts: number }>({ token: null, ts: 0 });

  const syncPersistedSessionId = useCallback(
    (nextSessionId: string) => {
      persistedSessionIdRef.current = nextSessionId;
      setPersistedSessionId((current) => current ?? nextSessionId);
      onSessionReady?.(nextSessionId);
      void mutate(getChatSessionsKey(gameName));
    },
    [gameName, mutate, onSessionReady],
  );

  const ensurePersistedSession = useCallback(async (): Promise<string> => {
    if (persistedSessionIdRef.current) {
      return persistedSessionIdRef.current;
    }

    if (!sessionCreatePromiseRef.current) {
      sessionCreatePromiseRef.current = createChatSession(gameName, modelRef.current)
        .then((session) => {
          syncPersistedSessionId(session.id);
          return session.id;
        })
        .catch((error) => {
          console.error("[chat] Failed to create session:", error);
          throw error;
        })
        .finally(() => {
          sessionCreatePromiseRef.current = null;
        });
    }

    return sessionCreatePromiseRef.current;
  }, [gameName, syncPersistedSessionId]);

  const { messages, status, sendMessage } = useChat({
    id: sessionClientId,
    messages: initialMessages.length > 0 ? initialMessages : undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        model: modelRef.current,
        gameId,
        gameName,
        gameFormat,
        genre,
        sessionId: persistedSessionIdRef.current,
        ...(assetsRef.current.length > 0
          ? { assetModelIds: assetsRef.current.map((asset) => asset._id) }
          : {}),
      }),
      headers: async (): Promise<Record<string, string>> => {
        const now = Date.now();
        if (now - tokenCacheRef.current.ts < 30_000 && tokenCacheRef.current.token) {
          return { Authorization: `Bearer ${tokenCacheRef.current.token}` };
        }

        const token = await getAccessToken();
        tokenCacheRef.current = { token, ts: now };
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  });

  const persistMessages = useCallback(
    async (nextMessages: UIMessage[]) => {
      if (nextMessages.length === 0 || isPersistingRef.current) return;

      const unsaved = nextMessages.slice(savedCountRef.current);
      if (unsaved.length === 0) return;

      isPersistingRef.current = true;
      try {
        const resolvedSessionId = await ensurePersistedSession();
        await saveChatMessages(
          gameName,
          resolvedSessionId,
          unsaved.map((message) => ({
            message_id: message.id,
            role: message.role,
            parts: message.parts as unknown[],
          })),
        );
        savedCountRef.current = nextMessages.length;
        void mutate(getChatSessionsKey(gameName));
      } catch (error) {
        console.error("[chat] Failed to persist messages:", error);
      } finally {
        isPersistingRef.current = false;
      }
    },
    [ensurePersistedSession, gameName, mutate],
  );

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (previousStatusRef.current !== "ready" && status === "ready" && messages.length > 0) {
      void persistMessages(messages);
    }
    previousStatusRef.current = status;
  }, [messages, persistMessages, status]);

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;
    void ensurePersistedSession().catch(() => undefined);
    sendMessage({ text: message.text.trim() });
    setSelectedAssets([]);
  };

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(40,15,20,0.66),rgba(16,8,10,0.82))]">
      <Conversation className="flex-1 h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-10" />}
              title="New feature thread"
              description="Describe a focused feature, fix, or gameplay improvement and the builder chat will work directly in atoms."
            />
          ) : (
            messages.map((message) => (
              <Fragment key={message.id}>
                {message.parts.map((part, index) => {
                  const key = `${message.id}-${index}`;

                  if (part.type === "text" && part.text.trim()) {
                    return (
                      <Message from={message.role} key={key}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                      </Message>
                    );
                  }

                  if (isToolUIPart(part)) {
                    return <ToolCall key={key} part={part} />;
                  }

                  return null;
                })}
              </Fragment>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#2a1014]/65 p-3">
        <PromptInput onSubmit={handleSubmit}>
          {selectedAssets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] px-3 py-1.5">
              {selectedAssets.map((asset) => (
                <div
                  key={asset._id}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.image?.url}
                    alt=""
                    className="size-4 shrink-0 rounded object-cover"
                  />
                  <span className="max-w-25 truncate text-[11px] text-white/50">
                    {asset.prompt ?? "3D Model"}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-white/40 transition-colors hover:text-white/70"
                    onClick={() =>
                      setSelectedAssets((current) =>
                        current.filter((entry) => entry._id !== asset._id),
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PromptInputBody>
            <PromptInputTextarea placeholder="Describe what to build..." />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputSelect value={model} onValueChange={setModel}>
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {MODELS.map((entry) => (
                    <PromptInputSelectItem key={entry.id} value={entry.id}>
                      <span className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entry.icon} alt="" className="size-4 shrink-0" />
                        {entry.name}
                      </span>
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7",
                      selectedAssets.length > 0 && "bg-blue-400/10 text-blue-400",
                    )}
                    onClick={() => setAssetDialogOpen(true)}
                  >
                    <Box className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedAssets.length > 0
                    ? `${selectedAssets.length} model${selectedAssets.length > 1 ? "s" : ""} attached`
                    : "Attach 3D models"}
                </TooltipContent>
              </Tooltip>
            </PromptInputTools>

            <PromptInputSubmit status={status} size="icon-sm" />
          </PromptInputFooter>
        </PromptInput>
      </div>

      <AssetModelDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        selected={selectedAssets}
        onToggle={(model) =>
          setSelectedAssets((current) =>
            current.some((entry) => entry._id === model._id)
              ? current.filter((entry) => entry._id !== model._id)
              : [...current, model],
          )
        }
      />
    </div>
  );
}
