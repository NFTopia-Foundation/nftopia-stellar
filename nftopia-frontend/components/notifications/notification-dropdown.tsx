"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  ShoppingBag,
  Tag,
  UserPlus,
  Heart,
  Info,
  Clock,
} from "lucide-react";
import {
  useNotificationStore,
  useUnreadCount,
  useNotificationActions,
} from "@/lib/stores/notification-store";
import { NotificationItem, NotificationType, NotificationState } from "@/lib/stores/types";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "bid":
      return <Tag className="h-4 w-4 text-amber-400" />;
    case "sale":
      return <ShoppingBag className="h-4 w-4 text-emerald-400" />;
    case "follow":
      return <UserPlus className="h-4 w-4 text-blue-400" />;
    case "like":
      return <Heart className="h-4 w-4 text-rose-400" />;
    case "auction":
      return <Clock className="h-4 w-4 text-purple-400" />;
    case "system":
    default:
      return <Info className="h-4 w-4 text-cyan-400" />;
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "Recently";
  }
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Activate real-time listener hook
  useRealtimeNotifications();

  const notifications = useNotificationStore((state: NotificationState) => state.notifications);
  const unreadCount = useUnreadCount();
  const { markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationActions();

  const toggleOpen = useCallback(() => {
    setIsOpen((prev: boolean) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Keyboard navigation & outside click handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Notifications center, ${unreadCount} unread`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/50 backdrop-blur-md border border-purple-500/30 text-gray-200 hover:text-white hover:border-purple-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        <Bell className="h-5 w-5" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-1.5 text-[11px] font-bold text-white shadow-lg ring-2 ring-[#181359] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-[#120d40] border border-purple-500/30 shadow-2xl backdrop-blur-xl z-50 overflow-hidden transform transition-all duration-200 animate-in fade-in slide-in-from-top-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-3 bg-[#181254]/80">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-wide text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-xs font-semibold text-purple-300">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-500/20 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-purple-500/10 scrollbar-thin scrollbar-thumb-purple-900">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <Bell className="h-10 w-10 text-purple-400/40 mb-2 stroke-1" />
                <p className="text-sm font-medium text-purple-200">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">We'll alert you when events happen.</p>
              </div>
            ) : (
              notifications.map((item: NotificationItem) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.read) markAsRead(item.id);
                  }}
                  className={`group relative flex items-start gap-3 p-3.5 transition-all duration-150 cursor-pointer ${
                    item.read
                      ? "bg-transparent opacity-75 hover:opacity-100 hover:bg-purple-900/20"
                      : "bg-purple-900/30 border-l-2 border-purple-500 hover:bg-purple-900/40"
                  }`}
                >
                  {/* Category Icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-950/60 border border-purple-500/30">
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold truncate ${item.read ? "text-gray-300" : "text-white"}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {item.link && (
                      <Link
                        href={item.link}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!item.read) markAsRead(item.id);
                          closeDropdown();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 mt-1.5 transition-colors"
                      >
                        <span>View details</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  {/* Unread Indicator & Delete Action */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    )}

                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        removeNotification(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
                      aria-label="Remove notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
