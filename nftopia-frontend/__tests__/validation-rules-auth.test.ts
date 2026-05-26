import { loginSchema, registerSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("passes with valid email and password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("fails with invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("fails with empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("passes with valid data", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("fails when passwords do not match", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("fails when password is under 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("passes with optional username", () => {
    const result = registerSchema.safeParse({ ...valid, username: "temy" });
    expect(result.success).toBe(true);
  });
});
