"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck, ExternalLink, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import type { SidebarNotification } from "@/lib/notifications/server";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  notifications: SidebarNotification[];
  unreadCount: number;
};

const severityClass = {
  info: "bg-sunken text-ink-secondary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasUnread = unreadCount > 0;

  function handleOpenChange() {
    setOpen((current) => !current);
    setError(null);
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      setError(null);
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotifications((items) =>
        items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      setError(null);
      const current = notifications.find((item) => item.id === id);
      const result = await dismissNotification(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotifications((items) => items.filter((item) => item.id !== id));
      if (current && !current.read_at) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    });
  }

  function handleNotificationClick(notification: SidebarNotification) {
    startTransition(async () => {
      setError(null);
      if (!notification.read_at) {
        const result = await markNotificationRead(notification.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setNotifications((items) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      setOpen(false);
      if (notification.action_href) {
        router.push(notification.action_href);
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={hasUnread ? `${unreadCount} notificações não lidas` : "Notificações"}
        aria-expanded={open}
        onClick={handleOpenChange}
        className="relative rounded-md p-[6px] text-ink-tertiary hover:bg-sunken"
      >
        <Bell size={15} strokeWidth={1.5} />
        {hasUnread && (
          <span className="-top-[3px] -right-[3px] absolute flex min-w-[16px] items-center justify-center rounded-full bg-orange px-[4px] text-[10px] leading-[16px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-sm w-[360px] rounded-lg border border-line bg-base shadow-[0_18px_40px_rgba(58,53,48,0.16)]">
          <div className="flex items-center justify-between border-b border-line px-md py-sm">
            <div>
              <div className="text-body-sm font-semibold text-ink">Notificações</div>
              <div className="text-meta text-ink-tertiary">
                {hasUnread ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
              </div>
            </div>
            <button
              type="button"
              disabled={!hasUnread || isPending}
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-xs rounded-md px-sm py-xs text-label text-ink-secondary hover:bg-sunken disabled:opacity-45"
            >
              {isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              Marcar lidas
            </button>
          </div>

          {error && (
            <div className="border-b border-line px-md py-xs text-meta text-danger">{error}</div>
          )}

          <div className="max-h-[420px] overflow-y-auto py-xs">
            {notifications.length === 0 ? (
              <div className="px-md py-lg text-center text-body-sm text-ink-tertiary">
                Nenhuma notificação ativa.
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "group grid grid-cols-[8px_1fr_auto] gap-sm border-line border-b px-md py-sm last:border-b-0 hover:bg-sunken",
                    !notification.read_at && "bg-orange-soft/35",
                  )}
                >
                  <span
                    className={cn(
                      "mt-[6px] size-[8px] rounded-full",
                      notification.read_at ? "bg-line" : "bg-orange",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="min-w-0 text-left"
                  >
                    <span
                      className={cn(
                        "mb-xs inline-flex rounded-sm px-xs py-[1px] text-[9px] font-medium uppercase tracking-[0.08em]",
                        severityClass[notification.severity as keyof typeof severityClass] ??
                          severityClass.info,
                      )}
                    >
                      {labelForSeverity(notification.severity)}
                    </span>
                    <span className="block truncate text-body-sm font-medium text-ink">
                      {notification.title}
                    </span>
                    <span className="mt-[2px] line-clamp-2 block text-meta text-ink-secondary">
                      {notification.body}
                    </span>
                    <span className="mt-xs flex items-center gap-xs text-[11px] text-ink-tertiary">
                      {relativeDate(notification.created_at)}
                      {notification.action_label && (
                        <>
                          <ExternalLink size={11} />
                          {notification.action_label}
                        </>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Dispensar notificação"
                    disabled={isPending}
                    onClick={() => handleDismiss(notification.id)}
                    className="mt-[2px] rounded-md p-xs text-ink-tertiary opacity-0 hover:bg-base hover:text-ink group-hover:opacity-100 focus:opacity-100 disabled:opacity-30"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function labelForSeverity(severity: string) {
  if (severity === "danger") return "Crítico";
  if (severity === "warning") return "Atenção";
  return "Info";
}

function relativeDate(date: string) {
  return formatDistanceToNowStrict(new Date(date), {
    addSuffix: true,
    locale: ptBR,
  });
}
