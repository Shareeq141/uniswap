import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafePublicImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".supabase.co") || url.hostname === "images.unsplash.com")
    );
  } catch {
    return false;
  }
}

export function formatListingAge(value: string | null | undefined): string | null {
  if (!value) return null;

  const createdAt = Date.parse(value);
  if (!Number.isFinite(createdAt)) return null;

  const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));

  if (elapsedDays < 1) return "Today";
  if (elapsedDays < 7) return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  if (elapsedDays < 28) {
    const weeks = Math.floor(elapsedDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  const months = Math.max(1, Math.floor(elapsedDays / 30));
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
