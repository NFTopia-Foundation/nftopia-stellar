import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "../app/[locale]/creator-dashboard/settings/page";
import { usePreferencesStore } from "../lib/stores/preferences-store";

/**
 * Covers the Settings page's two preference toggles added for #660
 * (currency selector) and #661 (push notification opt-out).
 */

jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (selector: (state: any) => unknown) =>
    selector({ user: { id: "user-1" }, setUser: jest.fn(), getCurrentUser: jest.fn() }),
}));

jest.mock("@/lib/context/AuthContext", () => ({
  useAuthContext: () => ({}),
}));

jest.mock("@/lib/services/profile", () => ({
  fetchLinkedWallets: jest.fn().mockResolvedValue([]),
  linkWalletWithChallenge: jest.fn(),
  unlinkWallet: jest.fn(),
}));

jest.mock("@/lib/stellar/wallet/freighter", () => ({
  connectFreighter: jest.fn(),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "pushNotifications.settingsTitle": "Push Notifications",
        "pushNotifications.settingsDescription": "Get notified even when closed.",
        "pushNotifications.settingsToggleOn": "Push notifications are on",
        "pushNotifications.settingsToggleOff": "Push notifications are off",
        "pushNotifications.unsupported": "Not supported in this browser.",
        "pushNotifications.subscribeError": "Couldn't enable push notifications.",
      };
      return map[key] ?? key;
    },
  }),
}));

let mockPushSupported = true;
let mockExistingSubscription: unknown = null;
const mockSubscribeToPush = jest.fn();
const mockUnsubscribeFromPush = jest.fn();

jest.mock("@/lib/push-notifications", () => ({
  isPushSupported: () => mockPushSupported,
  getExistingPushSubscription: () => Promise.resolve(mockExistingSubscription),
  subscribeToPush: (...args: unknown[]) => mockSubscribeToPush(...args),
  unsubscribeFromPush: (...args: unknown[]) => mockUnsubscribeFromPush(...args),
}));

describe("Settings page", () => {
  beforeEach(() => {
    mockPushSupported = true;
    mockExistingSubscription = null;
    mockSubscribeToPush.mockReset();
    mockUnsubscribeFromPush.mockReset();
    act(() => {
      usePreferencesStore.getState().resetPreferences();
    });
  });

  describe("currency selector (#660)", () => {
    it("is discoverable and defaults to XLM", async () => {
      render(<SettingsPage />);

      const select = await screen.findByTestId("display-currency-select");
      expect(select).toHaveValue("XLM");
    });

    it("updates the global preference when changed", async () => {
      render(<SettingsPage />);
      const select = await screen.findByTestId("display-currency-select");

      act(() => {
        (select as HTMLSelectElement).value = "USD";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await waitFor(() => {
        expect(usePreferencesStore.getState().display.currency).toBe("USD");
      });
    });
  });

  describe("push notification toggle (#661)", () => {
    it("shows the off state when there is no existing subscription", async () => {
      render(<SettingsPage />);
      expect(
        await screen.findByText("Push notifications are off"),
      ).toBeInTheDocument();
    });

    it("shows the on state when a subscription already exists", async () => {
      mockExistingSubscription = { endpoint: "https://push.example/1" };
      render(<SettingsPage />);
      expect(
        await screen.findByText("Push notifications are on"),
      ).toBeInTheDocument();
    });

    it("subscribes and flips the preference on when toggled on", async () => {
      mockSubscribeToPush.mockResolvedValue({ endpoint: "https://push.example/1" });
      render(<SettingsPage />);

      const toggle = await screen.findByTestId("push-settings-toggle");
      await act(async () => {
        toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(mockSubscribeToPush).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(usePreferencesStore.getState().notifications.push).toBe(true);
      });
    });

    it("unsubscribes and flips the preference off when toggled off", async () => {
      mockExistingSubscription = { endpoint: "https://push.example/1" };
      mockUnsubscribeFromPush.mockResolvedValue(undefined);
      render(<SettingsPage />);

      const toggle = await screen.findByTestId("push-settings-toggle");
      await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));

      await act(async () => {
        toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await waitFor(() => {
        expect(mockUnsubscribeFromPush).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(usePreferencesStore.getState().notifications.push).toBe(false);
      });
    });

    it("shows an unsupported message instead of the toggle when push isn't supported", async () => {
      mockPushSupported = false;
      render(<SettingsPage />);

      expect(
        await screen.findByText("Not supported in this browser."),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("push-settings-toggle")).not.toBeInTheDocument();
    });
  });
});
