import { mapAuthErrorToCode } from "../auth-error-codes";

describe("mapAuthErrorToCode", () => {
  it("maps missing fields error", () => {
    expect(mapAuthErrorToCode("missing required fields")).toBe("auth_validation_missing_fields");
  });
  it("maps invalid email error", () => {
    expect(mapAuthErrorToCode("invalid email format")).toBe("auth_validation_invalid_email");
  });
  it("maps password mismatch error", () => {
    expect(mapAuthErrorToCode("password mismatch")).toBe("auth_validation_password_mismatch");
  });
  it("maps wallet not connected error", () => {
    expect(mapAuthErrorToCode("wallet not connected")).toBe("auth_wallet_not_connected");
  });
  it("maps csrf error", () => {
    expect(mapAuthErrorToCode("csrf fetch failed")).toBe("auth_csrf_fetch_failed");
  });
  it("maps unknown error to fallback", () => {
    expect(mapAuthErrorToCode("something else")).toBe("auth_unknown_error");
  });
  it("maps error object with message", () => {
    expect(mapAuthErrorToCode({ message: "invalid credentials" })).toBe("auth_invalid_credentials");
  });
});
