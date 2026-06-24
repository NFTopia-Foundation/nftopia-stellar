import { shareCreatorProfile } from "@/lib/utils/share-profile";

describe("shareCreatorProfile", () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.assign(navigator, {
      share: undefined,
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    Object.assign(navigator, {
      share: originalShare,
      clipboard: originalClipboard,
    });
  });

  it("falls back to clipboard when native share is unavailable", async () => {
    const result = await shareCreatorProfile({
      url: "https://nftopia.test/en/creator/artist",
      title: "Artist",
    });

    expect(result.method).toBe("clipboard");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://nftopia.test/en/creator/artist",
    );
  });

  it("uses native share when available", async () => {
    Object.assign(navigator, {
      share: jest.fn().mockResolvedValue(undefined),
    });

    const result = await shareCreatorProfile({
      url: "https://nftopia.test/en/creator/artist",
      title: "Artist",
      text: "Check this creator",
    });

    expect(result.method).toBe("native");
    expect(navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://nftopia.test/en/creator/artist",
        title: "Artist",
      }),
    );
  });
});
