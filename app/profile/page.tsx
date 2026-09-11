"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Heart,
  ImagePlus,
  Loader2,
  PackageOpen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { fetchWishlistListingIds, removeWishlistItem } from "@/lib/wishlist";
import { isSafePublicImageUrl } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import ProfileAvatar, { getProfileDisplayName } from "@/components/ProfileAvatar";

const PROFILE_IMAGE_BUCKET = "listing-images";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year" },
] as const;

function getYearLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Year not provided";
  return YEAR_OPTIONS.find((option) => Number(option.value) === value)?.label || `${value} Year`;
}

function getStoragePath(publicUrl: string | null | undefined) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = publicUrl.slice(markerIndex + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

type WishlistListing = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  exchange_type?: string | null;
  type?: string | null;
  campus?: string | null;
  college_name?: string | null;
  images?: string[] | null;
  status?: string | null;
};

type WishlistEntry = {
  listing_id: string;
  listing: WishlistListing;
};

type ProfileStats = {
  listings: number | null;
  exchanged: number | null;
};

function formatJoinedDate(createdAt: string | undefined) {
  if (!createdAt) return "Join date unavailable";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Join date unavailable";
  return `Joined ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date)}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    profile,
    loading: authLoading,
    refreshProfile,
  } = useAuth();

  const [stats, setStats] = useState<ProfileStats>({ listings: null, exchanged: null });
  const [wishlistEntries, setWishlistEntries] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [collegeDraft, setCollegeDraft] = useState("");
  const [rollNumberDraft, setRollNumberDraft] = useState("");
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [yearDraft, setYearDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [showRollNumberDraft, setShowRollNumberDraft] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const displayName = useMemo(() => getProfileDisplayName(profile, user), [profile, user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);

  const loadProfileData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setWishlistLoading(true);
    setError(null);
    setWishlistError(null);

    const [listingsResult, exchangedResult, wishlistResult] = await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
      supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`)
        .eq("status", "accepted"),
      fetchWishlistListingIds(user.id),
    ]);

    setStats({
      listings: listingsResult.error ? null : listingsResult.count ?? 0,
      exchanged: exchangedResult.error ? null : exchangedResult.count ?? 0,
    });

    if (listingsResult.error || exchangedResult.error) {
      setError("Some profile activity could not be loaded. Please refresh and try again.");
    }

    if (wishlistResult.error) {
      setWishlistError("Wishlist data could not be loaded. Apply the wishlist migration, then refresh this page.");
      setWishlistEntries([]);
      setWishlistLoading(false);
      setLoading(false);
      return;
    }

    const listingIds = wishlistResult.data;
    if (listingIds.length === 0) {
      setWishlistEntries([]);
      setWishlistLoading(false);
      setLoading(false);
      return;
    }

    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, title, description, category, condition, exchange_type, type, campus, college_name, images, status")
      .in("id", listingIds);

    if (listingsError) {
      setWishlistError("Saved listings could not be loaded. Please refresh and try again.");
      setWishlistEntries([]);
    } else {
      const listingsById = new Map((listings || []).map((listing) => [listing.id, listing as WishlistListing]));
      setWishlistEntries(
        listingIds
          .map((listingId) => {
            const listing = listingsById.get(listingId);
            return listing
              ? { listing_id: listingId, listing }
              : null;
          })
          .filter((entry): entry is WishlistEntry => Boolean(entry)),
      );
    }

    setWishlistLoading(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (user) void loadProfileData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfileData, user]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function startEditing() {
    setNameDraft(displayName === user?.email ? "" : displayName);
    setCollegeDraft(profile?.campus?.trim() || "");
    setRollNumberDraft("");
    setDepartmentDraft(profile?.department?.trim() || "");
    setYearDraft(profile?.year_of_study === null || profile?.year_of_study === undefined ? "" : String(profile.year_of_study));
    setBioDraft(profile?.bio?.trim() || "");
    setShowRollNumberDraft(Boolean(profile?.show_roll_number));
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setProfileError(null);
    setProfileMessage(null);
    setEditing(true);

    const { data, error: privateProfileError } = await supabase.rpc("get_my_private_profile");
    if (privateProfileError) {
      setProfileError(`Private profile details could not be loaded: ${privateProfileError.message}`);
    } else {
      setRollNumberDraft(data?.[0]?.roll_number?.trim() || "");
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setProfileError("Profile photos must be 5 MB or smaller.");
      return;
    }

    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
    setProfileError(null);
  }

  function removePhotoDraft() {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || savingProfile) return;

    const fullName = nameDraft.trim().replace(/\s+/g, " ");
    const college = collegeDraft.trim().replace(/\s+/g, " ");
    const rollNumber = rollNumberDraft.trim().replace(/\s+/g, " ");
    const department = departmentDraft.trim().replace(/\s+/g, " ");
    const yearOfStudy = yearDraft.trim();
    const yearOfStudyValue = yearOfStudy === "" ? null : Number.parseInt(yearOfStudy, 10);
    const bio = bioDraft.trim();
    if (!fullName) {
      setProfileError("Please enter your name.");
      return;
    }
    if (fullName.length > 160 || college.length > 150 || rollNumber.length > 64 || department.length > 150 || bio.length > 1000) {
      setProfileError("One or more profile fields are too long.");
      return;
    }
    if (yearOfStudyValue !== null && (!Number.isInteger(yearOfStudyValue) || !YEAR_OPTIONS.some((option) => Number(option.value) === yearOfStudyValue))) {
      setProfileError("Please choose a valid year of study.");
      return;
    }

    const nameParts = fullName.split(" ");
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");

    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    let uploadedPhotoPath: string | null = null;
    let nextAvatarUrl = profile?.avatar_url || null;
    const previousPhotoPath = getStoragePath(profile?.avatar_url);

    try {
      if (selectedPhoto) {
        const extensionByType: Record<string, string> = {
          "image/gif": "gif",
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = extensionByType[selectedPhoto.type] || "jpg";
        const uniquePart = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        uploadedPhotoPath = `${user.id}/profile/${uniquePart}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PROFILE_IMAGE_BUCKET)
          .upload(uploadedPhotoPath, selectedPhoto, {
            cacheControl: "3600",
            contentType: selectedPhoto.type,
            upsert: false,
          });

        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from(PROFILE_IMAGE_BUCKET)
          .getPublicUrl(uploadedPhotoPath);
        if (!publicUrlData.publicUrl) throw new Error("Photo uploaded but no permanent URL was returned.");
        nextAvatarUrl = publicUrlData.publicUrl;
      } else if (removePhoto) {
        nextAvatarUrl = null;
      }

      const { error: updateError } = await supabase.rpc("update_my_profile", {
        p_full_name: fullName,
        p_first_name: firstName,
        p_last_name: lastName,
        p_campus: college || null,
        p_department: department || null,
        p_year_of_study: yearOfStudyValue,
        p_bio: bio || null,
        p_avatar_url: nextAvatarUrl,
        p_roll_number: rollNumber || null,
        p_show_roll_number: showRollNumberDraft,
      });

      if (updateError) throw updateError;

      if (previousPhotoPath && (removePhoto || uploadedPhotoPath) && previousPhotoPath !== uploadedPhotoPath) {
        const { error: removeError } = await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([previousPhotoPath]);
        if (removeError) console.warn("Could not remove the previous profile photo:", removeError.message);
      }

      await refreshProfile();
      setEditing(false);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setRemovePhoto(false);
      setProfileMessage("Profile updated.");
    } catch (error: unknown) {
      if (uploadedPhotoPath) {
        const { error: cleanupError } = await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([uploadedPhotoPath]);
        if (cleanupError) console.warn("Could not clean up the new profile photo:", cleanupError.message);
      }
      setProfileError(getErrorMessage(error, "Profile could not be updated."));
    }

    setSavingProfile(false);
  }

  async function removeFromWishlist(listingId: string) {
    if (!user || removingId) return;
    setRemovingId(listingId);
    const { error: removeError } = await removeWishlistItem(user.id, listingId);
    if (removeError) {
      setWishlistError(removeError.message);
    } else {
      setWishlistEntries((current) => current.filter((entry) => entry.listing_id !== listingId));
    }
    setRemovingId(null);
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#f7f7f3]">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
          <div className="glass-panel rounded-3xl p-8 text-center shadow-sm">
            {authLoading ? (
              <Loader2 className="mx-auto animate-spin text-teal-600" size={24} />
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-900">Log in to view your profile</h1>
                <Link href="/login" className="mt-5 inline-flex rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
                  Log in
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const authenticatedUser = user;
  if (!authenticatedUser) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f3]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-600">
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <section className="glass-panel rounded-3xl p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <ProfileAvatar profile={profile} user={user} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold text-slate-900 sm:text-3xl">{displayName}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><GraduationCap size={16} className="text-teal-600" />{profile?.campus?.trim() || "College not provided"}</span>
                  <span>{profile?.department?.trim() || "Department not provided"}</span>
                  <span>{getYearLabel(profile?.year_of_study)}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} className="text-teal-600" />{formatJoinedDate(authenticatedUser.created_at)}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={startEditing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Pencil size={15} />
              Edit Profile
            </button>
          </div>

          {profileMessage && <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700"><CheckCircle2 size={16} />{profileMessage}</p>}
          {error && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

          {editing && (
            <form onSubmit={saveProfile} className="glass-surface mt-6 grid gap-5 rounded-2xl p-4 sm:p-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {photoPreview ? (
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-slate-100 ring-4 ring-white shadow-sm">
                      <Image src={photoPreview} alt="New profile photo preview" fill sizes="112px" unoptimized className="object-cover" />
                    </div>
                  ) : (
                    <ProfileAvatar profile={removePhoto ? null : profile} user={user} size="lg" />
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile Picture</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                      <button type="button" onClick={() => photoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
                        <ImagePlus size={15} />
                        Change Photo
                      </button>
                      {(selectedPhoto || (profile?.avatar_url && !removePhoto)) && (
                        <button type="button" onClick={removePhotoDraft} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 hover:bg-white">
                          <X size={15} />
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Use a JPG, PNG, GIF, or WebP image up to 5 MB. You can change it later.</p>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                <input id="profile-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={160} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="profile-roll-number" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Roll Number</label>
                <input id="profile-roll-number" value={rollNumberDraft} onChange={(event) => setRollNumberDraft(event.target.value)} maxLength={64} placeholder="Your roll number" autoComplete="off" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                <label className="mt-2.5 flex items-start gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={showRollNumberDraft} onChange={(event) => setShowRollNumberDraft(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                  <span>Show my roll number on my public profile</span>
                </label>
                <p className="mt-1.5 text-xs text-slate-500">Off by default. Other users can only see it when you enable this setting.</p>
              </div>
              <div>
                <label htmlFor="profile-college" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">College</label>
                <input id="profile-college" value={collegeDraft} onChange={(event) => setCollegeDraft(event.target.value)} maxLength={150} placeholder="Your college" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="profile-department" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
                <input id="profile-department" value={departmentDraft} onChange={(event) => setDepartmentDraft(event.target.value)} maxLength={150} placeholder="Your department" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="profile-year" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Year of Study</label>
                <select id="profile-year" value={yearDraft} onChange={(event) => setYearDraft(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="profile-bio" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Bio</label>
                <textarea id="profile-bio" value={bioDraft} onChange={(event) => setBioDraft(event.target.value)} maxLength={1000} rows={4} placeholder="Tell other students a little about yourself" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              {profileError && <p className="text-sm text-red-700 sm:col-span-2">{profileError}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60">
                  {savingProfile && <Loader2 size={15} className="animate-spin" />}
                  Save Changes
                </button>
                <button type="button" onClick={() => { setEditing(false); setSelectedPhoto(null); setPhotoPreview(null); setRemovePhoto(false); }} disabled={savingProfile} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">Cancel</button>
              </div>
            </form>
          )}
        </section>

        <section className="glass-surface mt-6 rounded-2xl p-5 shadow-2xs sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">About</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{profile?.bio?.trim() || "Add a short bio so other students know a little about you."}</p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link href="/my-listings" className="glass-elevated rounded-2xl p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My Listings</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{loading || stats.listings === null ? "—" : stats.listings}</p>
            <p className="mt-1 text-xs font-medium text-teal-700">View your listings</p>
          </Link>
          <div className="glass-elevated rounded-2xl p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Items Exchanged</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{loading || stats.exchanged === null ? "—" : stats.exchanged}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Accepted requests</p>
          </div>
          <div className="glass-elevated rounded-2xl p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Wishlist</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{wishlistLoading ? "—" : wishlistEntries.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Saved listings</p>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-medium text-teal-500">Saved for later</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Wishlist</h2>
            </div>
            <Link href="/marketplace" className="text-sm font-semibold text-teal-600 hover:text-teal-700">Browse Marketplace</Link>
          </div>

          {wishlistError && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{wishlistError}</div>}
          {wishlistLoading ? (
            <div className="glass-surface rounded-2xl p-8 text-center text-sm text-slate-500">Loading wishlist...</div>
          ) : wishlistEntries.length === 0 ? (
            <div className="glass-surface rounded-2xl border-dashed p-10 text-center">
              <Heart className="mx-auto text-slate-300" size={30} />
              <h3 className="mt-3 font-bold text-slate-900">No saved listings yet</h3>
              <p className="mt-1 text-sm text-slate-500">Tap the heart on a marketplace listing to save it here.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {wishlistEntries.map((entry) => {
                const imageUrl = isSafePublicImageUrl(entry.listing.images?.[0]) ? entry.listing.images[0] : null;
                const isAvailable = entry.listing.status === "available";
                const card = (
                  <article className="glass-elevated group flex overflow-hidden rounded-2xl shadow-2xs">
                    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden bg-slate-100">
                      {imageUrl ? <Image src={imageUrl} alt={entry.listing.title} fill sizes="128px" className="object-cover" /> : <PackageOpen className="text-slate-300" size={30} />}
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 font-bold text-slate-900">{entry.listing.title}</h3>
                        <button type="button" onClick={(event) => { event.preventDefault(); void removeFromWishlist(entry.listing_id); }} disabled={removingId === entry.listing_id} aria-label="Remove from wishlist" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                          {removingId === entry.listing_id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{entry.listing.category || "Item"} · {entry.listing.college_name || entry.listing.campus || "College not provided"}</p>
                      {!isAvailable && <p className="mt-2 text-xs font-semibold text-amber-700">No longer available</p>}
                    </div>
                  </article>
                );
                return isAvailable ? <Link key={entry.listing_id} href={`/marketplace/${entry.listing_id}`} className="block">{card}</Link> : <div key={entry.listing_id}>{card}</div>;
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
