import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PushOptInPrompt } from "../components/notifications/PushOptInPrompt";
import { usePreferencesStore } from "../lib/stores/preferences-store";

/**
 * Covers #661's opt-in prompt behavior: not shown immediately on mount
 * (acceptance criteria #4), only shown when push is actually available and
 * the user hasn't already responded, and dismissing/enabling updates the
 * notifications.push preference so it doesn't nag again.
 */

let mockAuthUser: { id: string } | null = { id: "user-1" };

jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockAuthUser }),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "pushNotifications.promptTitle": "Turn on push notifications",
        "pushNotifications.promptBody": "Get notified even when closed.",
        "pushNotifications.notNow": "Not now",
        "pushNotifications.enable": "Enable",
        "pushNotifications.enabling": "Enabling...",
        "common.dismiss": "Dismiss",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockShowError = jest.fn();
jest.mock("@/lib/stores", () => ({
  useToast: () => ({ showError: mockShowError }),
}));

let mockPushSupported = true;
let mockPermission: NotificationPermission | null = "default";
const mockSubscribeToPush = jest.fn();

jest.mock("@/lib/push-notifications", () => ({
  isPushSupported: () => mockPushSupported,
  getPushPermission: () => mockPermission,
  subscribeToPush: (...args: unknown[]) => mockSubscribeToPush(...args),
}));

describe("PushOptInPrompt (#661)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthUser = { id: "user-1" };
    mockPushSupported = true;
    mockPermission = "default";
    mockSubscribeToPush.mockReset();
    act(() => {
      usePreferencesStore.getState().resetPreferences();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is not shown immediately on mount", () => {
    render(<PushOptInPrompt />);
    expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
  });

  it("appears after the deferred delay", () => {
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    expect(screen.getByTestId("push-opt-in-prompt")).toBeInTheDocument();
  });

  it("never appears for a logged-out visitor", () => {
    mockAuthUser = null;
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
  });

  it("never appears when push isn't supported", () => {
    mockPushSupported = false;
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
  });

  it("never appears when permission was already decided", () => {
    mockPermission = "granted";
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
  });

  it("subscribes and keeps notifications.push true when the user enables it", async () => {
    mockSubscribeToPush.mockResolvedValue({ endpoint: "https://push.example/1" });
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    const enableButton = screen.getByRole("button", { name: "Enable" });

    jest.useRealTimers();
    act(() => {
      enableButton.click();
    });

    await waitFor(() => {
      expect(mockSubscribeToPush).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
    });
    expect(usePreferencesStore.getState().notifications.push).toBe(true);
  });

  it("sets notifications.push to false when the user dismisses", () => {
    render(<PushOptInPrompt />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    const dismissButton = screen.getByRole("button", { name: "Not now" });
    act(() => {
      dismissButton.click();
    });

    expect(screen.queryByTestId("push-opt-in-prompt")).not.toBeInTheDocument();
    expect(usePreferencesStore.getState().notifications.push).toBe(false);
  });
});
