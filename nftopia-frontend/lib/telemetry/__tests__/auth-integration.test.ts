import { authInstrumentation } from "../auth-instrumentation";

describe("authInstrumentation integration", () => {
  it("emits login submit, success, and failure events with correct payloads", () => {
    const trackSpy = jest.spyOn(require("../index").telemetry, "track").mockImplementation(() => {});
    const attempt_id = authInstrumentation.submitLogin({ auth_method: "wallet", surface: "login_page" });
    expect(typeof attempt_id).toBe("string");
    authInstrumentation.loginSuccess({ auth_method: "wallet", attempt_id, startMs: Date.now() - 100, had_wallet_connected: true });
    authInstrumentation.loginFailed({ auth_method: "wallet", attempt_id, startMs: Date.now() - 200, error: "wallet not connected", failure_stage: "validation", validation_error_count: 1 });
    expect(trackSpy).toHaveBeenCalledWith("auth_login_submitted", expect.objectContaining({ auth_method: "wallet", surface: "login_page", attempt_id }));
    expect(trackSpy).toHaveBeenCalledWith("auth_login_succeeded", expect.objectContaining({ auth_method: "wallet", attempt_id, had_wallet_connected: true }));
    expect(trackSpy).toHaveBeenCalledWith("auth_login_failed", expect.objectContaining({ auth_method: "wallet", attempt_id, error_code: expect.any(String), failure_stage: "validation", validation_error_count: 1 }));
    trackSpy.mockRestore();
  });

  it("emits register submit, success, and failure events with correct payloads", () => {
    const trackSpy = jest.spyOn(require("../index").telemetry, "track").mockImplementation(() => {});
    const attempt_id = authInstrumentation.submitRegister({ auth_method: "email", surface: "register_page", has_optional_username: true, has_connected_wallet: false });
    expect(typeof attempt_id).toBe("string");
    authInstrumentation.registerSuccess({ auth_method: "email", attempt_id, startMs: Date.now() - 100, redirects_to_login: true });
    authInstrumentation.registerFailed({ auth_method: "email", attempt_id, startMs: Date.now() - 200, error: "password mismatch", failure_stage: "validation", validation_error_count: 1 });
    expect(trackSpy).toHaveBeenCalledWith("auth_register_submitted", expect.objectContaining({ auth_method: "email", surface: "register_page", attempt_id, has_optional_username: true, has_connected_wallet: false }));
    expect(trackSpy).toHaveBeenCalledWith("auth_register_succeeded", expect.objectContaining({ auth_method: "email", attempt_id, redirects_to_login: true }));
    expect(trackSpy).toHaveBeenCalledWith("auth_register_failed", expect.objectContaining({ auth_method: "email", attempt_id, error_code: expect.any(String), failure_stage: "validation", validation_error_count: 1 }));
    trackSpy.mockRestore();
  });
});
