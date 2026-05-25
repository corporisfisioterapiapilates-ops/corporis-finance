import { ConsultantChat } from "@/components/ai/consultant-chat";
import { createClient } from "@/lib/supabase/server";

type ConsultorPageProps = {
  searchParams?: Promise<{ conversation?: string | string[] }>;
};

export default async function ConsultorPage({ searchParams }: ConsultorPageProps) {
  const params = await searchParams;
  const selectedConversationParam = Array.isArray(params?.conversation)
    ? params?.conversation[0]
    : params?.conversation;
  const supabase = await createClient();

  const { data: conversations, error: conversationsError } = await supabase
    .from("ai_conversations")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false });
  const selectedConversationId =
    conversations?.find((conversation) => conversation.id === selectedConversationParam)?.id ??
    null;
  const { data: messages, error: messagesError } = selectedConversationId
    ? await supabase
        .from("ai_messages")
        .select("id,role,content,created_at,metadata")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  return (
    <>
      {conversationsError || messagesError ? (
        <div className="mb-md rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar o consultor agora. Tente novamente em instantes.
        </div>
      ) : null}
      <ConsultantChat
        conversations={conversations ?? []}
        messages={messages ?? []}
        selectedConversationId={selectedConversationId}
      />
    </>
  );
}
