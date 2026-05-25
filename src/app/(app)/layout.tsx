import type * as React from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getSidebarNotifications, syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organizations(name)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const userName = profile?.full_name?.trim() || user?.email || "Usuária";
  const orgName = profile?.organizations?.name ?? "Corporis Finance";
  await syncOrganizationNotifications();
  const notifications = await getSidebarNotifications();

  return (
    <AppShell userName={userName} orgName={orgName} notifications={notifications}>
      {children}
    </AppShell>
  );
}
