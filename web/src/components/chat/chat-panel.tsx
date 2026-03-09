"use client";

import { useState, useEffect, useRef, Fragment, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
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
import { ToolCall } from "./tool-call";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { MODELS, DEFAULT_MODEL } from "@/lib/constants";
import {
  getChatMessages,
  saveChatMessages,
  createWarRoom,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArrowLeft, Box, MessageSquare, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AssetModelDialog } from "./asset-model-dialog";
import type { AssetModel } from "@/lib/types";
import { useAppAuth } from "@/lib/privy-provider";

interface ChatPanelProps {
  gameId: string;
  gameName: string;
  sessionId: string;
  onBack?: () => void;
  onWarRoomCreated?: (warRoomId: string) => void;
}

/**
 * Outer wrapper: loads messages from DB, then renders ChatPanelContent
 * once ready so that useChat initializes with the correct messages.
 */
export function ChatPanel({ gameId, gameName, sessionId, onBack, onWarRoomCreated }: ChatPanelProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [initialSavedCount, setInitialSavedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getChatMessages(gameName, sessionId)
      .then((dbMessages) => {
        if (cancelled) return;
        if (dbMessages.length > 0) {
          const uiMessages: UIMessage[] = dbMessages.map((m) => ({
            id: m.message_id,
            role: m.role as "user" | "assistant",
            parts: m.parts as UIMessage["parts"],
          }));
          setInitialMessages(uiMessages);
          setInitialSavedCount(dbMessages.length);
        } else {
          setInitialMessages([]);
        }
      })
      .catch((err) => {
        console.error("[chat] Failed to load messages:", err);
        if (!cancelled) setInitialMessages([]);
      });

    return () => { cancelled = true; };
  }, [gameName, sessionId]);

  if (initialMessages === null) {
    return (
      <div className="flex flex-col h-full">
        {onBack && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/50 shrink-0">
            <Button variant="ghost" size="icon" className="size-6" onClick={onBack}>
              <ArrowLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-zinc-500">Back to sessions</span>
          </div>
        )}
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          Loading chat...
        </div>
      </div>
    );
  }

  return (
    <ChatPanelContent
      gameId={gameId}
      gameName={gameName}
      sessionId={sessionId}
      initialMessages={initialMessages}
      initialSavedCount={initialSavedCount}
      onBack={onBack}
      onWarRoomCreated={onWarRoomCreated}
    />
  );
}

/**
 * Inner component: useChat initializes here with the correct messages already loaded.
 */
interface ChatPanelContentProps {
  gameId: string;
  gameName: string;
  sessionId: string;
  initialMessages: UIMessage[];
  initialSavedCount: number;
  onBack?: () => void;
  onWarRoomCreated?: (warRoomId: string) => void;
}

function buildWarRoomPrompt(
  prompt: string,
  selectedAssets: AssetModel[]
): string {
  const trimmed = prompt.trim();
  if (selectedAssets.length === 0) return trimmed;

  const visualRefs = selectedAssets
    .slice(0, 5)
    .map((asset, index) => {
      const style = asset.style?.trim() ? ` | style: ${asset.style.trim()}` : "";
      return `${index + 1}. ${asset.prompt.trim()}${style}`;
    })
    .join("\n");

  return [
    trimmed,
    "",
    "Visual references to consider for Pixel:",
    visualRefs,
    "",
    "Use these references for art direction, cohesion, and polish, not as hard requirements.",
  ].join("\n");
}

function ChatPanelContent({
  gameId,
  gameName,
  sessionId,
  initialMessages,
  initialSavedCount,
  onBack,
  onWarRoomCreated,
}: ChatPanelContentProps) {
  const { getAccessToken } = useAppAuth();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const modelRef = useRef(model);
  modelRef.current = model;

  const [warRoomMode, setWarRoomMode] = useState(false);
  const [isCreatingWarRoom, setIsCreatingWarRoom] = useState(false);

  const [selectedAssets, setSelectedAssets] = useState<AssetModel[]>([]);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const assetsRef = useRef<AssetModel[]>([]);
  assetsRef.current = selectedAssets;

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const savedCountRef = useRef(initialSavedCount);

  const { messages, status, sendMessage } = useChat({
    id: sessionId,
    messages: initialMessages.length > 0 ? initialMessages : undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        model: modelRef.current,
        gameId,
        gameName,
        sessionId: sessionIdRef.current,
        ...(assetsRef.current.length > 0
          ? { assetModelIds: assetsRef.current.map((a) => a._id) }
          : {}),
      }),
      headers: async (): Promise<Record<string, string>> => {
        const token = await getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onFinish: () => {
      persistMessages(messages);
    },
  });

  // Also persist when messages change and status goes back to ready
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (
      prevStatusRef.current !== "ready" &&
      status === "ready" &&
      messages.length > 0 &&
      sessionId
    ) {
      persistMessages(messages);
    }
    prevStatusRef.current = status;
  }, [status, messages, sessionId]);

  const persistMessages = useCallback(
    async (msgs: UIMessage[]) => {
      if (!sessionId || msgs.length === 0) return;
      const unsaved = msgs.slice(savedCountRef.current);
      if (unsaved.length === 0) return;

      try {
        await saveChatMessages(
          gameName,
          sessionId,
          unsaved.map((m) => ({
            message_id: m.id,
            role: m.role,
            parts: m.parts as unknown[],
          }))
        );
        savedCountRef.current = msgs.length;
        console.log("[chat] Persisted", unsaved.length, "new messages");
      } catch (err) {
        console.error("[chat] Failed to persist messages:", err);
      }
    },
    [sessionId, gameName]
  );

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;
    const promptText = message.text.trim();

    if (warRoomMode) {
      setIsCreatingWarRoom(true);
      try {
        const warRoom = await createWarRoom(
          gameName,
          buildWarRoomPrompt(promptText, assetsRef.current)
        );
        setWarRoomMode(false);
        setSelectedAssets([]);
        onWarRoomCreated?.(warRoom.id);
      } catch (err) {
        console.error("[chat] War room creation failed:", err);
        throw err;
      } finally {
        setIsCreatingWarRoom(false);
      }
      return;
    }

    sendMessage({ text: promptText });
    setSelectedAssets([]);
  };

  return (
    <div className="flex flex-col h-full">
      {onBack && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/50 shrink-0">
          <Button variant="ghost" size="icon" className="size-6" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
          </Button>
          <span className="text-xs text-zinc-500">Back to sessions</span>
        </div>
      )}
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-10" />}
              title="Start building"
              description="Describe what you want to create and the AI agent will build it using atoms."
            />
          ) : (
            messages.map((message) => (
              <Fragment key={message.id}>
                {message.parts.map((part, i) => {
                  const key = `${message.id}-${i}`;

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

      <div className={cn(
        "p-3 border-t shrink-0",
        warRoomMode ? "border-amber-500/50 bg-amber-500/5" : "border-buu bg-buu-50"
      )}>
        <PromptInput onSubmit={handleSubmit}>
          {selectedAssets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-zinc-800/30">
              {selectedAssets.map((asset) => (
                <div
                  key={asset._id}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.image?.url}
                    alt=""
                    className="size-4 rounded object-cover shrink-0"
                  />
                  <span className="text-[11px] text-zinc-400 truncate max-w-25">
                    {asset.prompt ?? "3D Model"}
                  </span>
                  <button
                    className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                    onClick={() =>
                      setSelectedAssets((prev) =>
                        prev.filter((a) => a._id !== asset._id)
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
              <PromptInputSelect
                value={model}
                onValueChange={setModel}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {MODELS.map((m) => (
                    <PromptInputSelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.icon} alt="" className="size-4 shrink-0" />
                        {m.name}
                      </span>
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7",
                      warRoomMode && "text-amber-400 bg-amber-400/10"
                    )}
                    onClick={() => setWarRoomMode((prev) => !prev)}
                    disabled={isCreatingWarRoom}
                  >
                    <Swords className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {warRoomMode ? "War Room mode (active)" : "War Room mode"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7",
                      selectedAssets.length > 0 && "text-blue-400 bg-blue-400/10"
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
            <PromptInputSubmit status={isCreatingWarRoom ? "submitted" : status} />
          </PromptInputFooter>
        </PromptInput>
      </div>

      <AssetModelDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        selected={selectedAssets}
        onToggle={(model) =>
          setSelectedAssets((prev) =>
            prev.some((a) => a._id === model._id)
              ? prev.filter((a) => a._id !== model._id)
              : [...prev, model]
          )
        }
      />
    </div>
  );
}
