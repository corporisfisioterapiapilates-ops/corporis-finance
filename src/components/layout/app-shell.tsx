import type * as React from "react";

import type { SidebarNotificationsState } from "@/lib/notifications/server";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  userName: string;
  orgName: string;
  notifications: SidebarNotificationsState;
  children: React.ReactNode;
};

export function AppShell({ userName, orgName, notifications, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar userName={userName} orgName={orgName} notifications={notifications} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="conteudo-principal" className="flex-1 overflow-y-auto p-2xl">
          {children}
        </main>
      </div>
    </div>
  );
}
