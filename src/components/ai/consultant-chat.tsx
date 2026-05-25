"use client";

import { ArrowUp, Plus, Search, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import type { ConsultantToolResult } from "@/lib/ai/consultant";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Conversation = Pick<Tables<"ai_conversations">, "id" | "title" | "updated_at">;
type Message = Pick<Tables<"ai_messages">, "id" | "role" | "content" | "created_at"> & {
  metadata?: unknown;
};

type ConsultantChatProps = {
  conversations: Conversation[];
  messages: Message[];
  selectedConversationId: string | null;
};

const SUGGESTIONS = [
  "Quais despesas aumentaram mais neste mês?",
  "Como está meu resultado acumulado?",
  "Quanto tenho em lançamentos pendentes?",
  "Qual grupo de despesa merece atenção?",
];

export function ConsultantChat({
  conversations,
  messages,
  selectedConversationId,
}: ConsultantChatProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<ConsultantToolResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeConversation = conversations.find((item) => item.id === selectedConversationId);
  const groupedConversations = useMemo(() => conversations.slice(0, 20), [conversations]);
  const hasMessages = localMessages.length > 0 || streamingText;

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || isPending) return;
    setError(null);
    setInput("");
    setStreamingText("");
    setStreamingTools([]);
    setLocalMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      },
    ]);

    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: selectedConversationId, message }),
        });
        if (!response.ok || !response.body) {
          setError("Não foi possível consultar a IA agora.");
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let conversationId = selectedConversationId;
        let answer = "";
        let answerTools: ConsultantToolResult[] = [];

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const line = event.split("\n").find((item) => item.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as
              | { type: "meta"; conversationId: string }
              | { type: "tools"; toolResults: ConsultantToolResult[] }
              | { type: "delta"; text: string }
              | { type: "done" };
            if (payload.type === "meta") conversationId = payload.conversationId;
            if (payload.type === "tools") {
              answerTools = payload.toolResults;
              setStreamingTools(payload.toolResults);
            }
            if (payload.type === "delta") {
              answer += payload.text;
              setStreamingText(answer);
            }
          }
        }

        setLocalMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: answer,
            metadata: { toolResults: answerTools },
            created_at: new Date().toISOString(),
          },
        ]);
        setStreamingText("");
        if (!selectedConversationId && conversationId) {
          router.push(`/consultor?conversation=${conversationId}`);
        } else {
          router.refresh();
        }
      } catch {
        setError("Não foi possível consultar a IA agora.");
      }
    });
  }

  return (
    <div className="-m-[32px] flex h-screen flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-md border-b border-line bg-base px-lg">
        <div className="flex flex-1 items-center gap-sm">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-beige text-white">
            <Sparkles size={17} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-[20px] lowercase text-ink">consultor ia</h1>
            <p className="text-meta text-ink-tertiary">
              Pergunte sobre lançamentos, caixa, margens e orçamento
            </p>
          </div>
          <span className="rounded-full border border-beige/50 bg-warning-soft px-xs py-[2px] text-[9px] font-medium uppercase tracking-[0.12em] text-[#9F7E3D]">
            beta
          </span>
        </div>
        <div className="hidden items-center gap-xs rounded-full border border-line bg-sunken px-sm py-xs text-meta text-ink-tertiary lg:flex">
          <Shield size={12} strokeWidth={1.5} />
          Dados da organização atual
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 border-r border-line bg-base md:flex md:flex-col">
          <div className="border-b border-line p-md">
            <Link
              href="/consultor"
              className="mb-sm inline-flex h-9 w-full items-center justify-center gap-xs rounded-lg bg-orange text-body-sm font-medium text-white transition hover:bg-orange-hover"
            >
              <Plus size={15} strokeWidth={2} />
              Nova conversa
            </Link>
            <div className="relative">
              <Search
                size={13}
                strokeWidth={1.5}
                className="absolute left-sm top-1/2 -translate-y-1/2 text-ink-tertiary"
              />
              <input
                aria-label="Buscar conversas"
                placeholder="Buscar conversas..."
                className="h-9 w-full rounded-lg border border-line bg-surface pr-sm pl-8 text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-sm">
            {groupedConversations.length > 0 ? (
              groupedConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/consultor?conversation=${conversation.id}`}
                  className={cn(
                    "mb-xs block rounded-lg px-sm py-sm transition hover:bg-sunken",
                    conversation.id === selectedConversationId && "bg-orange-soft",
                  )}
                >
                  <p
                    className={cn(
                      "truncate text-body-sm font-medium text-ink",
                      conversation.id === selectedConversationId && "text-orange",
                    )}
                  >
                    {conversation.title}
                  </p>
                  <p className="mt-[2px] text-meta text-ink-tertiary">
                    {formatConversationDate(conversation.updated_at)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-lg bg-sunken px-md py-sm text-body-sm text-ink-tertiary">
                Nenhuma conversa ainda.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-md py-lg">
            <div className="mx-auto flex max-w-[780px] flex-col gap-lg">
              {!hasMessages ? (
                <EmptyConsultant onPick={sendMessage} />
              ) : (
                <>
                  {activeConversation ? (
                    <p className="text-center text-meta text-ink-tertiary">
                      {activeConversation.title}
                    </p>
                  ) : null}
                  {localMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  {streamingText ? (
                    <ChatMessage
                      message={{
                        id: "streaming",
                        role: "assistant",
                        content: streamingText,
                        metadata: { toolResults: streamingTools },
                        created_at: new Date().toISOString(),
                      }}
                    />
                  ) : null}
                </>
              )}
              {error ? (
                <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
                  {error}
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-base px-md py-md">
            <div className="mx-auto max-w-[780px]">
              {hasMessages ? (
                <div className="mb-sm flex flex-wrap gap-xs">
                  {SUGGESTIONS.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendMessage(suggestion)}
                      className="rounded-full border border-line bg-surface px-sm py-xs text-meta text-ink-secondary transition hover:border-orange hover:bg-orange-soft hover:text-orange"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-sm rounded-xl border border-line bg-surface p-sm shadow-sm-warm focus-within:border-orange focus-within:shadow-focus-orange">
                <textarea
                  value={input}
                  aria-label="Mensagem para o consultor IA"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Pergunte sobre seus lançamentos, fluxo de caixa, margens..."
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-sm py-2 text-body-sm text-ink outline-none placeholder:text-ink-tertiary"
                />
                <button
                  type="button"
                  aria-label="Enviar mensagem"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isPending}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange text-white transition hover:bg-orange-hover disabled:bg-line disabled:text-ink-tertiary"
                >
                  <ArrowUp size={16} strokeWidth={2} />
                </button>
              </div>
              <p className="mt-xs text-center text-meta text-ink-tertiary">
                A IA pode cometer erros. Revise números importantes antes de decidir.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyConsultant({ onPick }: { onPick: (message: string) => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <div className="mb-md flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange to-beige text-white shadow-md-warm">
        <Sparkles size={28} strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-[28px] lowercase text-ink">como posso ajudar?</h2>
      <p className="mt-sm max-w-[460px] text-body text-ink-tertiary">
        Faça perguntas em português sobre seus dados financeiros.
      </p>
      <div className="mt-lg flex max-w-[640px] flex-wrap justify-center gap-sm">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-full border border-line bg-surface px-md py-sm text-body-sm text-ink-secondary shadow-sm-warm transition hover:border-orange hover:bg-orange-soft hover:text-orange"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const toolResults = !isUser ? readToolResults(message.metadata) : [];
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start gap-sm")}>
      {!isUser ? (
        <div className="mt-xs flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-beige text-white">
          <Sparkles size={15} strokeWidth={1.5} />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[680px] whitespace-pre-wrap rounded-2xl px-md py-sm text-body-sm leading-relaxed shadow-sm-warm",
          isUser
            ? "rounded-br-md bg-orange text-white"
            : "rounded-tl-md border border-line bg-surface text-ink",
        )}
      >
        {message.content}
        {toolResults.length > 0 ? <ToolResults results={toolResults} /> : null}
      </div>
    </div>
  );
}

function ToolResults({ results }: { results: ConsultantToolResult[] }) {
  return (
    <div className="mt-md space-y-md whitespace-normal">
      {results.map((result) => (
        <div key={result.tool} className="rounded-xl border border-line bg-base p-md">
          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            <h3 className="font-display text-[17px] lowercase text-ink">{result.title}</h3>
            <div className="flex flex-wrap gap-xs">
              {result.actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-md border border-line bg-surface px-sm py-xs text-meta font-medium text-orange transition hover:bg-orange-soft"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-sm md:grid-cols-3">
            {result.cards.map((card) => (
              <div
                key={`${result.tool}-${card.label}`}
                className={cn("rounded-lg border bg-surface px-sm py-xs", cardToneClass(card.tone))}
              >
                <div className="text-meta text-ink-tertiary">{card.label}</div>
                <div className="tnum mt-[2px] font-display text-[18px] leading-tight text-ink">
                  {card.value}
                </div>
                {card.helper ? (
                  <div className="mt-[2px] text-meta text-ink-tertiary">{card.helper}</div>
                ) : null}
              </div>
            ))}
          </div>
          {result.table?.rows.length ? (
            <div className="mt-md overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full border-separate border-spacing-0 text-body-sm">
                <thead>
                  <tr>
                    {result.table.columns.map((column) => (
                      <th
                        key={column}
                        className="border-b border-line bg-sunken px-sm py-xs text-left text-label font-medium uppercase text-ink-tertiary"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.table.rows.map((row) => (
                    <tr key={row.join("|")}>
                      {row.map((cell, index) => (
                        <td
                          key={`${result.table?.columns[index] ?? "coluna"}-${cell}`}
                          className="border-b border-line px-sm py-xs last:border-b-0"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function cardToneClass(tone: ConsultantToolResult["cards"][number]["tone"]): string {
  const tones = {
    neutral: "border-line",
    success: "border-green/30 bg-success-soft/45",
    danger: "border-danger/30 bg-danger-soft/35",
    warning: "border-beige/50 bg-warning-soft/45",
  };
  return tones[tone];
}

function readToolResults(metadata: unknown): ConsultantToolResult[] {
  if (!metadata || typeof metadata !== "object" || !("toolResults" in metadata)) {
    return [];
  }
  const toolResults = (metadata as { toolResults?: unknown }).toolResults;
  return Array.isArray(toolResults) ? (toolResults as ConsultantToolResult[]) : [];
}

function formatConversationDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(date))
    .replace(".", "");
}
