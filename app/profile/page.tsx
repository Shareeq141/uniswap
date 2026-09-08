"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Heart,
  Loader2,
  PackageOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { fetchWishlistListingIds, removeWishlistItem } from "@/lib/wishlist";
import { isSafePublicImageUrl } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import ProfileAvatar, { getProfileDisplayName } from "@/components/ProfileAvatar";

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

  function startEditing() {
    setNameDraft(displayName === user?.email ? "" : displayName);
    setCollegeDraft(profile?.campus?.trim() || "");
    setProfileError(null);
    setProfileMessage(null);
    setEditing(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || savingProfile) return;

    const fullName = nameDraft.trim().replace(/\s+/g, " ");
    const college = collegeDraft.trim().replace(/\s+/g, " ");
    if (!fullName) {
      setProfileError("Please enter your name.");
      return;
    }
    if (fullName.length > 160 || college.length > 150) {
      setProfileError("Name or college is too long.");
      return;
    }

    const nameParts = fullName.split(" ");
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");

    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        campus: college || null,
      })
      .eq("id", user.id);

    if (updateError) {
      setProfileError(updateError.message);
    } else {
      await refreshProfile();
      setEditing(false);
      setProfileMessage("Profile updated.");
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
      <div className="min-h-screen bg-[#fbfcfa]">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
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
    <div className="min-h-screen bg-[#fbfcfa]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-600">
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <ProfileAvatar profile={profile} user={user} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold text-slate-900 sm:text-3xl">{displayName}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><GraduationCap size={16} className="text-teal-600" />{profile?.campus?.trim() || "College not provided"}</span>
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
            <form onSubmit={saveProfile} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Name</label>
                <input id="profile-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={160} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="profile-college" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">College</label>
                <input id="profile-college" value={collegeDraft} onChange={(event) => setCollegeDraft(event.target.value)} maxLength={150} placeholder="Your college" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </div>
              {profileError && <p className="text-sm text-red-700 sm:col-span-2">{profileError}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60">
                  {savingProfile && <Loader2 size={15} className="animate-spin" />}
                  Save Profile
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={savingProfile} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">Cancel</button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link href="/my-listings" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My Listings</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{loading || stats.listings === null ? "—" : stats.listings}</p>
            <p className="mt-1 text-xs font-medium text-teal-700">View your listings</p>
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Items Exchanged</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{loading || stats.exchanged === null ? "—" : stats.exchanged}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Accepted requests</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading wishlist...</div>
          ) : wishlistEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
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
                  <article className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:shadow-sm">
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
