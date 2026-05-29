import { updateMyProfile } from "@/lib/services/profile";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";

jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  API_CONFIG: {
    baseUrl: "http://localhost:3000/api/v1",
  },
}));

const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("profile update integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists profile edits through PATCH /users/me with wallet header", async () => {
    mockFetchWithAuth.mockResolvedValueOnce(
      jsonResponse({
          id: "user-1",
          username: "stellarbuilder",
          website: "https://mysite.com",
        })
    );

    await updateMyProfile("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234", {
      username: " stellarbuilder ",
      bio: "NFT creator on Stellar",
      avatarUrl: "",
      bannerUrl: undefined,
      twitterHandle: "@handle",
      instagramHandle: "@handle",
      website: "https://mysite.com",
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/users/me",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-wallet-address": "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234",
        }),
        body: JSON.stringify({
          username: "stellarbuilder",
          bio: "NFT creator on Stellar",
          twitterHandle: "@handle",
          instagramHandle: "@handle",
          website: "https://mysite.com",
        }),
      })
    );
  });
});
