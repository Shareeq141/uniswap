"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  User,
  MessageSquare,
  Gift,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isSafePublicImageUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { addWishlistItem, fetchWishlistListingIds, removeWishlistItem } from "@/lib/wishlist";
import Navbar from "@/components/Navbar";
import WishlistButton from "@/components/WishlistButton";

type Listing = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  campus?: string | null;
  exchange_type?: string | null;
  type?: string | null;
  swap_want?: string | null;
  owner_id: string;
  college_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  status: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type ExistingRequest = {
  id: string;
  status: "pending" | "accepted" | "declined";
  request_type: string;
  offered_item?: string | null;
  conversation_id?: string | null;
};

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const rawId = params?.id;
  const listingId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [item, setItem] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active photo in gallery
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Request state
  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null);
  const [swapOfferModalOpen, setSwapOfferModalOpen] = useState(false);
  const [offeredItemText, setOfferedItemText] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatusMessage, setRequestStatusMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);

  useEffect(() => {
    if (!listingId) return;

    let isMounted = true;

    async function fetchListing() {
      setLoading(true);
      setError(null);

      try {
        // Fetch item directly by ID
        const { data, error: itemError } = await supabase
          .from("listings")
          .select("*")
          .eq("id", listingId)
          .eq("status", "available")
          .maybeSingle();

        if (itemError) throw itemError;

        if (!data) {
          throw new Error("This listing could not be found or has been removed.");
        }

        if (!isMounted) return;
        setItem(data as Listing);

        // Fetch owner details
        if (data.owner_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, first_name, last_name")
            .eq("id", data.owner_id)
            .maybeSingle();

          if (profileError) console.warn("Could not load listing owner profile:", profileError.message);

          if (isMounted && profileData) {
            setOwner(profileData as Profile);
          }
        }

        // Check if logged-in user already requested this item
        if (user && user.id !== data.owner_id) {
          const { data: reqData, error: reqError } = await supabase
            .from("contact_requests")
            .select("id, status, request_type, offered_item")
            .eq("listing_id", listingId)
            .eq("requester_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (reqError) throw reqError;

          if (isMounted && reqData) {
            // Check if there is an existing conversation
            let convId: string | null = null;
            if (reqData.status === "accepted") {
              const { data: convData, error: convError } = await supabase
                .from("conversations")
                .select("id")
                .eq("listing_id", listingId)
                .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (convError) throw convError;

              if (convData) convId = convData.id;
            }

            setExistingRequest({
              ...reqData,
              conversation_id: convId,
            });
          }
        }
      } catch (err: unknown) {
        console.error("Listing fetch error:", err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load listing.";
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchListing();

    return () => {
      isMounted = false;
    };
  }, [listingId, user]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!user || !listingId) {
        setIsSaved(false);
        return;
      }

      void fetchWishlistListingIds(user.id).then(({ data, error: wishlistError }) => {
        if (!active) return;
        if (wishlistError) {
          console.warn("Could not load listing wishlist state:", wishlistError.message);
          return;
        }
        setIsSaved(data.includes(listingId));
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [listingId, user]);

  async function toggleWishlist() {
    if (!listingId) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (savingWishlist) return;

    setSavingWishlist(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user || sessionData.session.user.id !== user.id) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;
      const result = isSaved
        ? await removeWishlistItem(userId, listingId)
        : await addWishlistItem(userId, listingId);

      if (result.error && result.error.code !== "23505") {
        console.warn("Could not update listing wishlist:", result.error.message);
        return;
      }

      setIsSaved((current) => !current);
    } finally {
      setSavingWishlist(false);
    }
  }

  async function handleSendRequest(offeredText?: string) {
    if (!item) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.id === item.owner_id) {
      setRequestStatusMessage("You are the owner of this listing.");
      return;
    }

    const exchangeType = item.exchange_type || item.type || "Give Away";
    const isSwap = exchangeType.toLowerCase().includes("swap");

    if (isSwap && (!offeredText || !offeredText.trim())) {
      setSwapOfferModalOpen(true);
      return;
    }

    setSendingRequest(true);
    setRequestStatusMessage(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user || session.user.id !== user.id) {
        throw new Error("Your session has expired. Please log in again and retry the request.");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("contact_requests")
        .insert({
          listing_id: item.id,
          requester_id: session.user.id,
          owner_id: item.owner_id,
          request_type: isSwap ? "Swap" : "Give Away",
          offered_item: isSwap ? offeredText?.trim() : null,
          status: "pending",
          request_seen: false,
        })
        .select("id, status, request_type, offered_item")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          setRequestStatusMessage("You have already submitted a request for this item.");
        } else {
          throw insertError;
        }
      } else if (inserted) {
        setExistingRequest(inserted as ExistingRequest);
        setSwapOfferModalOpen(false);
        setRequestStatusMessage("Your request has been sent to the owner!");
      }
    } catch (err: unknown) {
      console.error("Submit request error:", err);
      const message = err instanceof Error ? err.message : "Could not send request. Please try again.";
      setRequestStatusMessage(message);
    } finally {
      setSendingRequest(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafcfb] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-slate-500 font-medium text-sm">
            <Loader2 className="animate-spin text-teal-600" size={22} />
            <span>Loading item details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-[#fafcfb] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Item Not Found</h2>
            <p className="mt-2 text-sm text-slate-500">
              {error || "The requested item is no longer available or was removed."}
            </p>
            <div className="mt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition"
              >
                <ArrowLeft size={16} />
                <span>Return to Marketplace</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isGiveAway = (item.exchange_type || item.type || "").toLowerCase().includes("give");
  const photos = (item.images || []).filter(isSafePublicImageUrl);
  const isOwner = user?.id === item.owner_id;

  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        {/* BACK LINK */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-600 transition mb-6"
        >
          <ArrowLeft size={16} />
          <span>Back to Marketplace</span>
        </Link>

        {/* MAIN CARD */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm grid md:grid-cols-2 gap-0">
          {/* LEFT: IMAGE GALLERY */}
          <div className="flex flex-col border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50 p-6">
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
              {photos.length > 0 ? (
                <Image
                  src={photos[activePhotoIndex] || photos[0]}
                  alt={item.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="text-8xl">
                  {item.category?.toLowerCase().includes("calc")
                    ? "🧮"
                    : item.category?.toLowerCase().includes("book")
                    ? "📚"
                    : item.category?.toLowerCase().includes("lab")
                    ? "🥼"
                    : item.category?.toLowerCase().includes("draft")
                    ? "📐"
                    : "📦"}
                </div>
              )}

              {/* EXCHANGE TYPE BADGE */}
              <div
                className={`absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider ${
                  isGiveAway
                    ? "bg-teal-500 text-white shadow-xs"
                    : "bg-slate-900 text-white shadow-xs"
                }`}
              >
                {isGiveAway ? <Gift size={13} /> : <ArrowLeftRight size={13} />}
                <span>{isGiveAway ? "Give Away" : "Swap"}</span>
              </div>
            </div>

            {/* THUMBNAILS */}
            {photos.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {photos.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      activePhotoIndex === idx
                        ? "border-teal-500 ring-2 ring-teal-200"
                        : "border-slate-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={url}
                      alt={`${item.title} preview thumbnail ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* RIGHT: DETAILS & ACTIONS */}
          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              {/* TITLE AND CONDITION */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-lg bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 text-xs font-semibold">
                    {item.category}
                  </span>
                  <span className="rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1 text-xs font-semibold">
                    {item.condition}
                  </span>
                  <WishlistButton
                    saved={isSaved}
                    loading={savingWishlist}
                    onToggle={() => void toggleWishlist()}
                    className="ml-auto h-9 w-9 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-red-500"
                  />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                  {item.title}
                </h1>
              </div>

              {/* WHAT I HAVE / WHAT I WANT (FOR SWAP ONLY) */}
              {!isGiveAway && (
                <div className="rounded-2xl bg-teal-50/70 border border-teal-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                    <ArrowLeftRight size={14} />
                    <span>Swap Requirements</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">What I Have:</span>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{item.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">What I Want:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {item.swap_want || "Open to any student item offer"}
                    </p>
                  </div>
                </div>
              )}

              {/* DESCRIPTION */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Item Description
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                  {item.description || "No description provided."}
                </p>
              </div>

              {/* CAMPUS & OWNER INFO */}
              <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <GraduationCap size={18} className="mt-0.5 shrink-0 text-teal-600" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">College</span>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">
                      {item.college_name || item.campus || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <User size={18} className="text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Listed By</span>
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">
                      {owner?.full_name || "Student"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              {requestStatusMessage && (
                <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs font-medium text-teal-800 text-center">
                  {requestStatusMessage}
                </div>
              )}

              {isOwner ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center">
                  <span className="text-xs font-semibold text-slate-600">
                    You are the owner of this listing.
                  </span>
                  <div className="mt-2">
                    <Link
                      href="/requests"
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 underline"
                    >
                      Check incoming requests &rarr;
                    </Link>
                  </div>
                </div>
              ) : existingRequest ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {existingRequest.status === "pending" && (
                        <Clock size={16} className="text-amber-500" />
                      )}
                      {existingRequest.status === "accepted" && (
                        <CheckCircle2 size={16} className="text-teal-600" />
                      )}
                      {existingRequest.status === "declined" && (
                        <AlertCircle size={16} className="text-slate-400" />
                      )}
                      <span className="text-xs font-bold capitalize text-slate-800">
                        Request Status: {existingRequest.status}
                      </span>
                    </div>

                    <Link
                      href="/requests"
                      className="text-xs font-semibold text-teal-600 hover:underline"
                    >
                      View in Requests
                    </Link>
                  </div>

                  {existingRequest.offered_item && (
                    <p className="text-xs text-slate-600">
                      Your offer: <strong>{existingRequest.offered_item}</strong>
                    </p>
                  )}

                  {existingRequest.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (existingRequest.conversation_id) {
                          router.push(`/messages/${existingRequest.conversation_id}`);
                        } else {
                          router.push("/messages");
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-xs font-bold text-white hover:bg-teal-600 transition"
                    >
                      <MessageSquare size={15} />
                      <span>Chat with Student</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      router.push("/login");
                      return;
                    }
                    if (!isGiveAway) {
                      setSwapOfferModalOpen(true);
                    } else {
                      handleSendRequest();
                    }
                  }}
                  disabled={sendingRequest}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 py-4 font-bold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-60 text-sm"
                >
                  {sendingRequest ? (
                    <>
                      <Loader2 className="animate-spin" size={17} />
                      <span>Sending Request...</span>
                    </>
                  ) : isGiveAway ? (
                    <>
                      <Gift size={18} />
                      <span>Request This Item (Free)</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight size={18} />
                      <span>Propose Swap Offer</span>
                    </>
                  )}
                </button>
              )}

              <p className="mt-3 text-center text-[11px] text-slate-400">
                UniSwap exchanges are completely free with direct on-campus handovers.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* SWAP OFFER PROMPT MODAL */}
      {swapOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-700 font-bold text-base">
                <ArrowLeftRight size={20} />
                <span>Propose Item Swap</span>
              </div>
              <button
                type="button"
                onClick={() => setSwapOfferModalOpen(false)}
                aria-label="Close swap offer modal"
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <span className="font-bold text-slate-800">Owner requested: </span>
              <span>{item.swap_want || "Anything useful on campus"}</span>
            </div>

            <div>
              <label
                htmlFor="offeredItemText"
                className="block text-xs font-bold uppercase text-slate-700 mb-1.5"
              >
                What I Can Offer (Required)
              </label>
              <textarea
                id="offeredItemText"
                value={offeredItemText}
                onChange={(e) => setOfferedItemText(e.target.value)}
                placeholder="e.g. Casio Scientific Calculator FX-82MS, or Engineering Drawing Instruments kit..."
                rows={3}
                required
                maxLength={250}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSwapOfferModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingRequest || !offeredItemText.trim()}
                onClick={() => handleSendRequest(offeredItemText)}
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {sendingRequest ? "Sending Offer..." : "Submit Swap Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
