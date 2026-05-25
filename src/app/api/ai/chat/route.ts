import { z } from "zod";

import {
  answerConsultantQuestion,
  buildConsultantContext,
  runConsultantTools,
} from "@/lib/ai/consultant";
import { createClient } from "@/lib/supabase/server";

const chatSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) {
    return Response.json({ error: "Organização não encontrada." }, { status: 403 });
  }

  const organizationId = profile.organization_id;
  const conversation = await resolveConversation({
    conversationId: parsed.data.conversationId ?? null,
    message: parsed.data.message,
    organizationId,
    userId: user.id,
  });
  if (!conversation.ok) {
    return Response.json({ error: conversation.error }, { status: 400 });
  }

  const { error: userMessageError } = await supabase.from("ai_messages").insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    role: "user",
    content: parsed.data.message,
  });
  if (userMessageError) {
    return Response.json({ error: "Não foi possível salvar a mensagem." }, { status: 500 });
  }

  const [{ data: history }, { data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("role,content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("transactions")
      .select("amount,cash_date,description,status,type,category_id")
      .order("cash_date", { ascending: false })
      .limit(600),
    supabase
      .from("chart_of_accounts")
      .select("id,code,name,parent_id")
      .order("display_order", { ascending: true }),
  ]);

  const context = buildConsultantContext(transactions ?? [], categories ?? []);
  const toolResults = runConsultantTools({
    question: parsed.data.message,
    transactions: transactions ?? [],
    categories: categories ?? [],
  });
  const answer = await answerConsultantQuestion({
    question: parsed.data.message,
    context,
    toolResults,
    history: (history ?? [])
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
  });

  await supabase.from("ai_messages").insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    role: "assistant",
    content: answer,
    metadata: { context, toolResults },
  });
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  const encoder = new TextEncoder();
  const chunks = chunkText(answer);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "meta", conversationId: conversation.id })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "tools", toolResults })}\n\n`),
      );
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

async function resolveConversation({
  conversationId,
  message,
  organizationId,
  userId,
}: {
  conversationId: string | null;
  message: string;
  organizationId: string;
  userId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (conversationId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .single();
    return error || !data ? { ok: false, error: "Conversa inválida." } : { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      title: buildTitle(message),
    })
    .select("id")
    .single();

  return error || !data
    ? { ok: false, error: "Não foi possível criar a conversa." }
    : { ok: true, id: data.id };
}

function buildTitle(message: string): string {
  return message.length > 48 ? `${message.slice(0, 45)}...` : message;
}

function chunkText(text: string): string[] {
  const words = text.split(/(\s+)/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + word).length > 42) {
      chunks.push(current);
      current = word;
    } else {
      current += word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
