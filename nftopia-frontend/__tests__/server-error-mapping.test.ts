import { mapServerError } from "@/lib/errors/serverErrorMapper";

describe("mapServerError", () => {
  it("maps known field errors shape", () => {
    const { fieldErrors, formError } = mapServerError({
      errors: { email: "Email already taken", password: ["Too weak"] },
    });
    expect(fieldErrors.email).toBe("Email already taken");
    expect(fieldErrors.password).toBe("Too weak");
    expect(formError).toBe("");
  });

  it("maps single message string", () => {
    const { fieldErrors, formError } = mapServerError({ message: "Invalid credentials" });
    expect(formError).toBe("Invalid credentials");
    expect(fieldErrors).toEqual({});
  });

  it("maps error string fallback", () => {
    const { formError } = mapServerError({ error: "Server error" });
    expect(formError).toBe("Server error");
  });

  it("returns generic message for unknown payload", () => {
    const { formError } = mapServerError(null);
    expect(formError).toBe("Something went wrong. Please try again.");
  });

  it("returns generic message for empty object", () => {
    const { formError } = mapServerError({});
    expect(formError).toBe("Something went wrong. Please try again.");
  });
});
