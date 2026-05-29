import { getTelemetryConfig, TelemetryConfig } from "../../lib/telemetry/config";

describe("getTelemetryConfig", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });


  it("returns enabled: false for invalid env values", () => {
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED = "false";
    process.env.NEXT_PUBLIC_TELEMETRY_PROVIDER = "invalid";
    Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
    const config = getTelemetryConfig();
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("noop");
  });


  it("returns enabled: false in test env", () => {
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED = "true";
    process.env.NEXT_PUBLIC_TELEMETRY_PROVIDER = "posthog";
    Object.defineProperty(process.env, "NODE_ENV", { value: "test" });
    const config = getTelemetryConfig();
    expect(config.enabled).toBe(false);
  });


  it("returns correct config for valid env", () => {
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED = "true";
    process.env.NEXT_PUBLIC_TELEMETRY_PROVIDER = "posthog";
    process.env.NEXT_PUBLIC_TELEMETRY_DEBUG = "true";
    Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
    const config = getTelemetryConfig();
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("posthog");
    expect(config.debug).toBe(true);
  });
});
