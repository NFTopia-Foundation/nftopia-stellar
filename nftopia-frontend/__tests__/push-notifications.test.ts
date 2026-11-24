import {
  getExistingPushSubscription,
  getPushPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "../lib/push-notifications";

/**
 * Covers #661's opt-in/opt-out flow at the lib layer: permission handling,
 * creating/reusing a subscription, registering it with the backend, and
 * tearing it down again.
 */

jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: jest.fn().mockResolvedValue({ ok: true }),
}));

const { fetchWithAuth } = jest.requireMock("@/lib/api/fetchWithAuth") as {
  fetchWithAuth: jest.Mock;
};

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

describe("push-notifications (#661)", () => {
  let mockSubscription: {
    endpoint: string;
    toJSON: jest.Mock;
    unsubscribe: jest.Mock;
  };
  let mockPushManager: {
    getSubscription: jest.Mock;
    subscribe: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE";

    mockSubscription = {
      endpoint: "https://push.example/sub-1",
      toJSON: jest.fn().mockReturnValue({
        endpoint: "https://push.example/sub-1",
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
      unsubscribe: jest.fn().mockResolvedValue(true),
    };

    mockPushManager = {
      getSubscription: jest.fn().mockResolvedValue(null),
      subscribe: jest.fn().mockResolvedValue(mockSubscription),
    };

    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: mockPushManager }),
        },
      },
      configurable: true,
    });

    (global as any).PushManager = function () {};

    (global as any).Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    };
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ORIGINAL_ENV;
  });

  describe("isPushSupported / getPushPermission", () => {
    it("reports supported when serviceWorker, PushManager, and Notification all exist", () => {
      expect(isPushSupported()).toBe(true);
    });

    it("reports the current Notification.permission", () => {
      expect(getPushPermission()).toBe("default");
    });

    it("reports unsupported when PushManager is missing", () => {
      delete (global as any).PushManager;
      expect(isPushSupported()).toBe(false);
    });
  });

  describe("subscribeToPush", () => {
    it("requests permission, subscribes, and registers with the backend", async () => {
      const subscription = await subscribeToPush();

      expect((global as any).Notification.requestPermission).toHaveBeenCalled();
      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true }),
      );
      expect(fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/push/subscribe"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(subscription).toBe(mockSubscription);
    });

    it("reuses an existing subscription instead of creating a new one", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);

      await subscribeToPush();

      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
      expect(fetchWithAuth).toHaveBeenCalled();
    });

    it("returns null without subscribing when permission is denied", async () => {
      (global as any).Notification.requestPermission.mockResolvedValue("denied");

      const subscription = await subscribeToPush();

      expect(subscription).toBeNull();
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
      expect(fetchWithAuth).not.toHaveBeenCalled();
    });

    it("throws when the VAPID public key isn't configured", async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      await expect(subscribeToPush()).rejects.toThrow();
    });
  });

  describe("unsubscribeFromPush", () => {
    it("unsubscribes in the browser and notifies the backend", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);

      await unsubscribeFromPush();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect(fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/push/unsubscribe"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("does nothing when there is no existing subscription", async () => {
      mockPushManager.getSubscription.mockResolvedValue(null);

      await unsubscribeFromPush();

      expect(fetchWithAuth).not.toHaveBeenCalled();
    });
  });

  describe("getExistingPushSubscription", () => {
    it("returns the current subscription, if any", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
      await expect(getExistingPushSubscription()).resolves.toBe(mockSubscription);
    });

    it("returns null when push isn't supported", async () => {
      delete (global as any).PushManager;
      await expect(getExistingPushSubscription()).resolves.toBeNull();
    });
  });
});
