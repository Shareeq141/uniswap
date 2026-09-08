import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/lib/auth-context";
import { isSafePublicImageUrl } from "@/lib/utils";

type ProfileAvatarProps = {
  profile: UserProfile | null;
  user: User | null;
  size?: "sm" | "lg";
};

export function getProfileDisplayName(profile: UserProfile | null, user: User | null) {
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;

  const nameFromParts = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return nameFromParts || user?.email || "Student";
}

export function getProfileInitials(profile: UserProfile | null, user: User | null) {
  const name = getProfileDisplayName(profile, user);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "S";
}

export default function ProfileAvatar({ profile, user, size = "sm" }: ProfileAvatarProps) {
  const imageUrl = isSafePublicImageUrl(profile?.avatar_url) ? profile?.avatar_url : null;
  const dimensions = size === "lg" ? 112 : 36;
  const className = size === "lg"
    ? "relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-teal-100 text-3xl font-extrabold text-teal-700 ring-4 ring-white shadow-sm"
    : "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-teal-100 text-sm font-extrabold text-teal-700";

  return (
    <div className={className}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${getProfileDisplayName(profile, user)} profile photo`}
          fill
          sizes={`${dimensions}px`}
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{getProfileInitials(profile, user)}</span>
      )}
    </div>
  );
}
