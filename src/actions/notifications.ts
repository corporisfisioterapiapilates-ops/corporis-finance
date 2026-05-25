"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type NotificationActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function markNotificationRead(id: string): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) {
    return { ok: false, error: "Não foi possível marcar a notificação como lida." };
  }

  revalidatePath("/");
  return { ok: true, message: "Notificação marcada como lida." };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .is("dismissed_at", null);

  if (error) {
    return { ok: false, error: "Não foi possível marcar as notificações como lidas." };
  }

  revalidatePath("/");
  return { ok: true, message: "Notificações marcadas como lidas." };
}

export async function dismissNotification(id: string): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({
      dismissed_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: "Não foi possível dispensar a notificação." };
  }

  revalidatePath("/");
  return { ok: true, message: "Notificação dispensada." };
}
