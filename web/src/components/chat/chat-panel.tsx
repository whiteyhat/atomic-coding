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
  listChatSessions,
  createChatSession,
  getChatMessages,
  saveChatMessages,
  createWarRoom,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePrivy } from "@privy-io/react-auth";
import { MessageSquare, Plus, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatPanelProps {
  gameId: string;
  gameName: string;
  onWarRoomCreated?: (warRoomId: string) => void;
}

export function ChatPanel({ gameId, gameName, onWarRoomCreated }: ChatPanelProps) {
  const { getAccessToken } = usePrivy();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const modelRef = useRef(model);
  modelRef.current = model;

  const [warRoomMode, setWarRoomMode] = useState(false);
  const [isCreatingWarRoom, setIsCreatingWarRoom] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const savedCountRef = useRef(0);

  // Load or create a session on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Try to find an existing session
        const sessions = await listChatSessions(gameName, 1);
        let sid: string;

        if (sessions.length > 0) {
          sid = sessions[0].id;
          // Load existing messages
          const dbMessages = await getChatMessages(gameName, sid);
          if (!cancelled && dbMessages.length > 0) {
            const uiMessages: UIMessage[] = dbMessages.map((m) => ({
              id: m.message_id,
              role: m.role as "user" | "assistant",
              parts: m.parts as UIMessage["parts"],
            }));
            setInitialMessages(uiMessages);
            savedCountRef.current = dbMessages.length;
          }
        } else {
          // Create a fresh session
          const session = await createChatSession(gameName, model);
          sid = session.id;
        }

        if (!cancelled) {
          setSessionId(sid);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[chat] Failed to init session:", err);
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName, gameId]);

  const { messages, status, sendMessage } = useChat({
    id: sessionId ?? undefined,
    messages: initialMessages.length > 0 ? initialMessages : undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ model: modelRef.current, gameId, gameName, sessionId: sessionIdRef.current }),
      headers: async (): Promise<Record<string, string>> => {
        const token = await getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onFinish: () => {
      // Save new messages after each assistant response
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
      // Only save messages we haven't saved yet
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

    if (warRoomMode) {
      setIsCreatingWarRoom(true);
      try {
        const warRoom = await createWarRoom(
          gameName,
          message.text.trim()
        );
        setWarRoomMode(false);
        onWarRoomCreated?.(warRoom.id);
      } catch (err) {
        console.error("[chat] War room creation failed:", err);
        throw err; // Re-throw so PromptInput preserves input text
      } finally {
        setIsCreatingWarRoom(false);
      }
      return;
    }

    sendMessage({ text: message.text });
  };

  const handleNewSession = async () => {
    try {
      const session = await createChatSession(gameName, model);
      setSessionId(session.id);
      setInitialMessages([]);
      savedCountRef.current = 0;
      // Force page reload to reset useChat state
      window.location.reload();
    } catch (err) {
      console.error("[chat] Failed to create new session:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
                    className="size-7"
                    onClick={handleNewSession}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New session</TooltipContent>
              </Tooltip>
            </PromptInputTools>
            <PromptInputSubmit status={isCreatingWarRoom ? "submitted" : status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
