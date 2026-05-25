"use client";

import { LogOut, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import type { SidebarNotificationsState } from "@/lib/notifications/server";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-config";
import { NotificationBell } from "./notification-bell";

type SidebarProps = {
  userName: string;
  orgName: string;
  notifications: SidebarNotificationsState;
};

export function Sidebar({ userName, orgName, notifications }: SidebarProps) {
  const pathname = usePathname();
  const initial = (userName || "?").trim().charAt(0).toUpperCase();

  return (
    <aside
      className="flex w-[240px] shrink-0 flex-col border-r border-line bg-base"
      aria-label="Navegação principal"
    >
      <div className="flex items-center justify-center border-b border-line px-[20px] pt-lg pb-md">
        <Image
          src="/logo/corporis-logo.png"
          alt="Corporis Fisioterapia & Pilates"
          width={2920}
          height={956}
          className="h-[42px] w-auto max-w-full"
          priority
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-md" aria-label="Módulos do sistema">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-[20px] pt-md pb-xs text-meta font-medium uppercase tracking-[0.1em] text-ink-tertiary">
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative mx-sm flex items-center gap-md rounded-md px-md py-[10px] text-body transition-colors",
                    active
                      ? "bg-orange-soft font-medium text-orange before:absolute before:top-1/2 before:-left-sm before:h-[20px] before:w-[3px] before:-translate-y-1/2 before:rounded-r-sm before:bg-orange before:content-['']"
                      : "text-ink-secondary hover:bg-sunken",
                  )}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="warning" className="px-[6px] text-[9px]">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-[10px] border-t border-line px-md py-md">
        <div className="flex size-[34px] items-center justify-center rounded-full bg-beige-light text-body-sm font-medium text-ink">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-sm font-medium text-ink">{userName}</div>
          <div className="truncate text-meta text-ink-tertiary">{orgName}</div>
        </div>
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          className="rounded-md p-[6px] hover:bg-sunken"
        >
          <Settings size={15} strokeWidth={1.5} className="text-ink-tertiary" />
        </Link>
        <NotificationBell
          notifications={notifications.notifications}
          unreadCount={notifications.unreadCount}
        />
        <form action={logout}>
          <button type="submit" aria-label="Sair" className="rounded-md p-[6px] hover:bg-sunken">
            <LogOut size={15} strokeWidth={1.5} className="text-ink-tertiary" />
          </button>
        </form>
      </div>
    </aside>
  );
}
