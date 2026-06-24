import {
  buildCreatorProfilePath,
  buildInstagramUrl,
  buildTwitterUrl,
  getCreatorAvatarUrl,
  getCreatorDisplayName,
  sanitizeExternalUrl,
} from "@/lib/utils/creator-profile";

describe("creator-profile utils", () => {
  it("builds dicebear avatar when avatar url is missing", () => {
    const url = getCreatorAvatarUrl("creator-123", null);
    expect(url).toContain("api.dicebear.com");
    expect(url).toContain("creator-123");
  });

  it("prefers provided avatar url", () => {
    expect(getCreatorAvatarUrl("creator-123", "https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
  });

  it("builds display name from username or id", () => {
    expect(getCreatorDisplayName("artist", "id-1")).toBe("artist");
    expect(getCreatorDisplayName(null, "12345678-abcd-efgh")).toMatch(/123456…/);
  });

  it("builds locale-aware profile paths", () => {
    expect(buildCreatorProfilePath("artist", "en")).toBe("/en/creator/artist");
  });

  it("sanitizes external urls", () => {
    expect(sanitizeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeNull();
  });

  it("builds social urls from handles", () => {
    expect(buildTwitterUrl("@artist")).toBe("https://twitter.com/artist");
    expect(buildInstagramUrl("artist")).toBe("https://instagram.com/artist");
  });
});
