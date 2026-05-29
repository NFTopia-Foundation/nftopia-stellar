import { telemetry } from "../../lib/telemetry";

describe("telemetry client", () => {
  it("does not throw when track is called before init", () => {
    expect(() => telemetry.track("test_event")).not.toThrow();
  });

  it("does not throw when identify is called before init", () => {
    expect(() => telemetry.identify("user1")).not.toThrow();
  });

  it("does not throw when reset is called before init", () => {
    expect(() => telemetry.reset()).not.toThrow();
  });

  it("init is idempotent", async () => {
    await expect(telemetry.init()).resolves.toBeUndefined();
    await expect(telemetry.init()).resolves.toBeUndefined();
  });
});
