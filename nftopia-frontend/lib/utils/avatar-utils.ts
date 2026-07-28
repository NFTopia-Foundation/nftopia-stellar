"use client";

export const VALID_AVATAR_PATHS = {
  CREATOR_AVATAR_FALLBACK: "/images/fallbacks/avatar-fallback.svg",
} as const;

export function isInvalidCreatorImagePath(path: string): boolean {
  if (!path) return true;
  return path.includes("placeholder");
}