"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotifications } from "@/lib/stores/preferences-store";
import {
  getPushPermission,
  isPushSupported,
  subscribeToPush,
} from "@/lib/push-notifications";
import { useToast } from "@/lib/stores";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Prompts the user to opt in to browser push notifications (#661).
 *
 * Deliberately not shown on first page load (acceptance criteria #4):
 * it waits PROMPT_DELAY_MS after mount before appearing at all, so a
 * first-time visitor sees the app before being asked for anything.
 * `notifications.push` (in preferences-store, previously unused anywhere)
 * doubles as "should we still offer this" — dismissing sets it to false so
 * the prompt doesn't nag on every visit; the Settings toggle can turn it
 * back on to re-enable push (or re-show the prompt path) later.
 */
const PROMPT_DELAY_MS = 20_000;

export function PushOptInPrompt() {
  const { t } = useTranslation();
  const authUser = useAuthStore((state) => state.user);
  const { notifications, setNotifications } = useNotifications();
  const { showError } = useToast();

  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!authUser || !isPushSupported()) return;
    if (!notifications.push) return;
    if (getPushPermission() !== "default") return;

    const timer = setTimeout(() => setVisible(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [authUser, notifications.push]);

  if (!visible) return null;

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      const subscription = await subscribeToPush();
      if (!subscription) {
        // Permission denied, or the user dismissed the native prompt —
        // stop asking until they re-enable it from Settings.
        setNotifications({ push: false });
      }
    } catch {
      showError(t("pushNotifications.subscribeError"));
      setNotifications({ push: false });
    } finally {
      setSubscribing(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setNotifications({ push: false });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("pushNotifications.promptTitle")}
      data-testid="push-opt-in-prompt"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-purple-900/40 bg-[#1E1A45] p-4 shadow-xl sm:left-auto sm:right-4"
    >
      <button
        type="button"
        aria-label={t("common.dismiss")}
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-gray-400 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <Bell className="h-5 w-5 flex-shrink-0 text-purple-400" />
        <div>
          <p className="text-sm font-semibold text-white">
            {t("pushNotifications.promptTitle")}
          </p>
          <p className="mt-1 text-xs text-gray-300">
            {t("pushNotifications.promptBody")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:text-white"
        >
          {t("pushNotifications.notNow")}
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={subscribing}
          className="rounded-lg bg-gradient-to-r from-[#4e3bff] to-[#9747ff] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {subscribing
            ? t("pushNotifications.enabling")
            : t("pushNotifications.enable")}
        </button>
      </div>
    </div>
  );
}
