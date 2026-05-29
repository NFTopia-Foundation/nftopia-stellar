import { authInstrumentation } from "../auth-instrumentation";

describe("authInstrumentation", () => {
  it("generates unique attempt IDs", () => {
    const id1 = authInstrumentation.submitLogin({ auth_method: "email", surface: "login_page" });
    const id2 = authInstrumentation.submitLogin({ auth_method: "wallet", surface: "login_page" });
    expect(id1).not.toBe(id2);
  });

  it("computes latency correctly for login", () => {
    const attempt_id = "testid";
    const startMs = Date.now();
    const spy = jest.spyOn(Date, "now").mockReturnValue(startMs + 500);
    authInstrumentation.loginSuccess({ auth_method: "email", attempt_id, startMs, had_wallet_connected: false });
    spy.mockRestore();
  });

  it("computes latency correctly for register", () => {
    const attempt_id = "testid";
    const startMs = Date.now();
    const spy = jest.spyOn(Date, "now").mockReturnValue(startMs + 800);
    authInstrumentation.registerSuccess({ auth_method: "wallet", attempt_id, startMs, redirects_to_login: true });
    spy.mockRestore();
  });
});
