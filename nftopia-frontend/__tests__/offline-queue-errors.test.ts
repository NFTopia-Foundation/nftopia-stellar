import {
  classifyReplayError,
  OfflineActionConflictError,
} from "@/lib/offline-queue/errors";

describe("offline queue error classification", () => {
  it("detects an explicit conflict error", () => {
    const error = new OfflineActionConflictError("Changed on server", {
      serverRevision: "rev-2",
      serverState: { favorited: false },
    });
    const failure = classifyReplayError(error);
    expect(failure.kind).toBe("conflict");
    expect(failure.conflict?.serverRevision).toBe("rev-2");
    expect(failure.conflict?.serverState).toEqual({ favorited: false });
  });

  it("detects HTTP 409 REST conflicts and extracts server state", () => {
    const error = {
      status: 409,
      message: "Someone else updated this",
      serverRevision: "rev-9",
      serverState: { following: false, followerCount: 3 },
    };
    const failure = classifyReplayError(error, 42);
    expect(failure.kind).toBe("conflict");
    expect(failure.conflict?.message).toBe("Someone else updated this");
    expect(failure.conflict?.detectedAt).toBe(42);
    expect(failure.conflict?.serverState).toEqual({ following: false, followerCount: 3 });
  });

  it("detects GraphQL conflict extensions and revision mismatch messages", () => {
    const graphQl = {
      graphQLErrors: [{ message: "Stale revision", extensions: { code: "CONFLICT" } }],
    };
    expect(classifyReplayError(graphQl).kind).toBe("conflict");
    expect(classifyReplayError(new Error("revision mismatch")).kind).toBe("conflict");
  });

  it("treats transport and server errors as retryable", () => {
    expect(classifyReplayError(new TypeError("Failed to fetch")).kind).toBe("retryable");
    expect(classifyReplayError({ status: 503, message: "down" }).kind).toBe("retryable");
    expect(classifyReplayError({ code: "TIMEOUT" }).kind).toBe("retryable");
    expect(classifyReplayError({}).kind).toBe("retryable");
  });

  it("treats validation and authorization failures as fatal", () => {
    expect(classifyReplayError({ status: 400 }).kind).toBe("fatal");
    expect(classifyReplayError({ status: 401 }).kind).toBe("fatal");
    expect(classifyReplayError({ code: "VALIDATION_ERROR" }).kind).toBe("fatal");
  });
});
