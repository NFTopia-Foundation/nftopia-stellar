export function getCreatorAvatarUrl(
  userId: string,
  avatarUrl?: string | null,
): string {
  if (avatarUrl?.trim()) {
    return avatarUrl;
  }

  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(userId)}`;
}

export function getCreatorBannerUrl(
  userId: string,
  bannerUrl?: string | null,
): string | null {
  if (bannerUrl?.trim()) {
    return bannerUrl;
  }

  return null;
}

export function getCreatorDisplayName(
  username?: string | null,
  id?: string,
): string {
  if (username?.trim()) {
    return username.trim();
  }

  if (id) {
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }

  return "Creator";
}

export function buildCreatorProfilePath(
  usernameOrId: string,
  locale?: string,
): string {
  const slug = encodeURIComponent(usernameOrId);
  return locale ? `/${locale}/creator/${slug}` : `/creator/${slug}`;
}

export function normalizeSocialHandle(
  handle?: string | null,
): string | null {
  if (!handle?.trim()) return null;
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

export function buildTwitterUrl(handle?: string | null): string | null {
  const normalized = normalizeSocialHandle(handle);
  return normalized ? `https://twitter.com/${normalized}` : null;
}

export function buildInstagramUrl(handle?: string | null): string | null {
  const normalized = normalizeSocialHandle(handle);
  return normalized ? `https://instagram.com/${normalized}` : null;
}

export function sanitizeExternalUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
