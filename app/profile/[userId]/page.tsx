"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  GraduationCap,
  Gift,
  Loader2,
  PackageOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { type UserProfile } from "@/lib/auth-context";
import { formatListingAge, isSafePublicImageUrl } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import ProfileAvatar from "@/components/ProfileAvatar";

type PublicProfile = UserProfile & {
  roll_number?: string | null;
  created_at?: string | null;
};

type PublicListing = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  exchange_type?: string | null;
  type?: string | null;
  swap_want?: string | null;
  campus?: string | null;
  college_name?: string | null;
  images?: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

function getListingFallbackIcon(category: string | null | undefined) {
  const normalized = (category || "").toLowerCase();
  if (normalized.includes("calc")) return "🧮";
  if (normalized.includes("book")) return "📚";
  if (normalized.includes("lab")) return "🥼";
  if (normalized.includes("draft")) return "📐";
  if (normalized.includes("elect")) return "💻";
  return "📦";
}

export default function PublicProfilePage() {
  const params = useParams();
  const rawUserId = params?.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : (rawUserId as string | undefined);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function loadPublicProfile() {
      setLoading(true);
      setNotFound(false);
      setError(null);

      try {
        const { data: profileRows, error: profileError } = await supabase.rpc("get_public_profile", {
          p_profile_id: userId,
        });

        if (profileError) throw profileError;

        const publicProfile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
        if (!publicProfile?.id) {
          if (active) setNotFound(true);
          return;
        }

        const { data: listingRows, error: listingsError } = await supabase
          .from("listings")
          .select("id, title, description, category, condition, exchange_type, type, swap_want, campus, college_name, images, status, created_at")
          .eq("owner_id", userId)
          .eq("status", "available")
          .order("created_at", { ascending: false });

        if (listingsError) throw listingsError;
        if (!active) return;

        setProfile(publicProfile as PublicProfile);
        setListings((listingRows || []) as PublicListing[]);
      } catch (loadError: unknown) {
        if (!active) return;
        console.error("Public profile load error:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Could not load this profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPublicProfile();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3]">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
          <Loader2 className="animate-spin text-teal-600" size={24} />
        </main>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#f7f7f3]">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 py-12">
          <div className="glass-panel w-full rounded-3xl p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Profile not found</h1>
            <p className="mt-2 text-sm text-slate-500">This profile may no longer be available.</p>
            <Link href="/marketplace" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
              <ArrowLeft size={16} />
              Back to Marketplace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-600">
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <section className="glass-panel rounded-3xl p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileAvatar profile={profile} user={null} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {profile.full_name?.trim() || "Student"}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap size={16} className="text-teal-600" />
                  {profile.campus?.trim() || "College not provided"}
                </span>
                <span>{profile.department?.trim() || "Department not provided"}</span>
                <span>{profile.year_of_study ? `${profile.year_of_study}${profile.year_of_study === 1 ? "st" : profile.year_of_study === 2 ? "nd" : profile.year_of_study === 3 ? "rd" : "th"} Year` : "Year not provided"}</span>
              </div>
              {profile.roll_number && (
                <p className="mt-3 text-sm font-medium text-slate-600">Roll Number: {profile.roll_number}</p>
              )}
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {profile.bio?.trim() || "No bio provided."}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Listings</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{listings.length}</p>
          </div>
        </section>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-medium text-teal-500">Currently available</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Listings</h2>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="glass-surface rounded-3xl border-dashed p-10 text-center">
              <PackageOpen className="mx-auto text-slate-300" size={32} />
              <h3 className="mt-3 font-bold text-slate-900">No available listings</h3>
              <p className="mt-1 text-sm text-slate-500">This student has no listings currently visible in the marketplace.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => {
                const imageUrl = isSafePublicImageUrl(listing.images?.[0]) ? listing.images[0] : null;
                const isGiveAway = (listing.exchange_type || listing.type || "").toLowerCase().includes("give");
                const listingAge = formatListingAge(listing.created_at);
                const college = listing.college_name || listing.campus || "College not provided";

                return (
                  <article key={listing.id} className="glass-elevated group flex flex-col overflow-hidden rounded-3xl shadow-2xs">
                    <div className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden bg-slate-100">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={listing.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="text-5xl">{getListingFallbackIcon(listing.category)}</div>
                      )}
                      <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${isGiveAway ? "bg-teal-500 text-white" : "bg-slate-900 text-white"}`}>
                        {isGiveAway ? <Gift size={12} /> : <ArrowLeftRight size={12} />}
                        {isGiveAway ? "Give Away" : "Swap"}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-base font-bold text-slate-900">{listing.title}</h3>
                        {listing.condition && <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{listing.condition}</span>}
                      </div>
                      {!isGiveAway && listing.swap_want && <div className="mt-2.5 rounded-xl border border-teal-100 bg-teal-50/80 p-2 text-xs"><span className="font-bold text-teal-800">What I Want: </span><span className="text-teal-900">{listing.swap_want}</span></div>}
                      <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{listing.description || "No description provided."}</p>
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <div className="flex items-start gap-1.5"><GraduationCap size={14} className="mt-0.5 shrink-0 text-teal-600" /><span className="line-clamp-2"><strong className="text-slate-700">College:</strong> {college}</span></div>
                        {listingAge && <p className="text-slate-400">{listingAge}</p>}
                      </div>
                      <Link href={`/marketplace/${listing.id}`} className="mt-3 block w-full rounded-xl bg-slate-900 py-2.5 text-center text-xs font-bold text-white transition hover:bg-slate-800">View Details</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
