"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Send,
  Check,
  X,
  Package,
  MessageCircle,
  Clock,
  ArrowLeftRight,
  Gift,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type UserProfile } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import ProfileAvatar from "@/components/ProfileAvatar";

type RequestRecord = {
  id: string;
  listing_id: string;
  requester_id: string;
  owner_id: string;
  request_type: string;
  offered_item?: string | null;
  status: "pending" | "accepted" | "declined";
  request_seen: boolean;
  created_at: string;
  // Enriched relations
  listing?: {
    id: string;
    title: string;
    category?: string | null;
    campus?: string | null;
    college_name?: string | null;
    swap_want?: string | null;
    images?: string[] | null;
  } | null;
  other_profile?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

function getRequestErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    const message =
      typeof details.message === "string"
        ? details.message
        : error instanceof Error
        ? error.message
        : "";
    const code = typeof details.code === "string" ? details.code : "";
    const detailsText = typeof details.details === "string" ? details.details : "";
    const hint = typeof details.hint === "string" ? details.hint : "";

    const combined = `${message} ${detailsText} ${hint}`.toLowerCase();
    const missingRequestSeenColumn =
      combined.includes("request_seen") &&
      (code === "42703" ||
        code === "PGRST204" ||
        combined.includes("does not exist") ||
        combined.includes("schema cache") ||
        combined.includes("could not find the") ||
        combined.includes("undefined column"));

    if (missingRequestSeenColumn) {
      return "Requests need a database update. Apply supabase/migrations/20260907_request_seen.sql, then refresh this page.";
    }

    if (message) {
      return [
        message,
        code ? `Code: ${code}` : "",
        detailsText ? `Details: ${detailsText}` : "",
        hint ? `Hint: ${hint}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    }
    if (code) return `Supabase request failed (code ${code}).`;
  }

  if (error instanceof Error && error.message) return error.message;

  return "Could not load requests. Please try again.";
}

function logRequestDatabaseError(error: unknown): void {
  if (!error || typeof error !== "object") {
    console.error("Load requests database error:", error);
    return;
  }

  const details = error as Record<string, unknown>;
  console.error("Load requests database error:", {
    message: typeof details.message === "string" ? details.message : undefined,
    code: typeof details.code === "string" ? details.code : undefined,
    details: typeof details.details === "string" ? details.details : undefined,
    hint: typeof details.hint === "string" ? details.hint : undefined,
    errorType: error.constructor?.name,
    errorString: String(error),
    errorProperties: Object.getOwnPropertyNames(error),
    errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
  });
}

export default function RequestsPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshRequestCount } = useAuth();

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [incomingRequests, setIncomingRequests] = useState<RequestRecord[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<RequestRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let requestStage = "contact_requests.select";

    try {
      // 1. Fetch both incoming and outgoing contact requests for this user
      const requestResult = await supabase
        .from("contact_requests")
        .select("id, listing_id, requester_id, owner_id, request_type, offered_item, status, request_seen, created_at")
        .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (requestResult.error) {
        const rawError = requestResult.error;
        console.error("REQUESTS RAW SUPABASE RESULT", {
          operation: "contact_requests.select",
          data: requestResult.data,
          error: rawError,
          errorType: rawError.constructor?.name,
          errorString: String(rawError),
          errorProperties: Object.getOwnPropertyNames(rawError),
          errorJson: JSON.stringify(rawError, Object.getOwnPropertyNames(rawError)),
        });
      }

      const { data: rawRequests, error: reqError } = requestResult;

      if (reqError) throw reqError;

      const records = (rawRequests || []) as RequestRecord[];
      if (records.length === 0) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        void refreshRequestCount();
        setLoading(false);
        return;
      }

      // 2. Fetch associated listings
      requestStage = "listings.select";
      const listingIds = Array.from(new Set(records.map((r) => r.listing_id)));
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("id, title, category, campus, college_name, swap_want, images")
        .in("id", listingIds);

      if (listingsError) throw listingsError;

      const listingMap = new Map(
        (listingsData || []).map((l) => [l.id, l])
      );

      // 3. Fetch associated profiles
      const profileIds = Array.from(
        new Set(
          records.flatMap((r) => [r.requester_id, r.owner_id]).filter((id) => id !== user.id)
        )
      );

      let profileMap = new Map<string, UserProfile>();
      if (profileIds.length > 0) {
        requestStage = "profiles.select";
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", profileIds);

        if (profilesError) throw profilesError;

        if (profilesData) {
          profileMap = new Map(profilesData.map((p) => [p.id, p as UserProfile]));
        }
      }

      // 4. Enrich records
      const enriched = records.map((r) => {
        const isIncoming = r.owner_id === user.id;
        const otherPersonId = isIncoming ? r.requester_id : r.owner_id;
        return {
          ...r,
          listing: listingMap.get(r.listing_id) || null,
          other_profile: profileMap.get(otherPersonId) || { id: otherPersonId, full_name: "Student", avatar_url: null },
        };
      });

      const incoming = enriched.filter((r) => r.owner_id === user.id);
      const unseenPendingIds = incoming
        .filter((r) => r.status === "pending" && !r.request_seen)
        .map((r) => r.id);

      let seenIds = new Set<string>();
      if (unseenPendingIds.length > 0) {
        requestStage = "contact_requests.update.request_seen";
        const seenResult = await supabase
          .from("contact_requests")
          .update({ request_seen: true })
          .in("id", unseenPendingIds)
          .eq("owner_id", user.id)
          .eq("status", "pending")
          .eq("request_seen", false)
          .select("id");

        const { data: seenRows, error: seenError } = seenResult;

        if (seenError) {
          console.warn("Could not mark requests as seen:", seenError.message);
        } else {
          seenIds = new Set((seenRows || []).map((row) => row.id));
        }
      }

      setIncomingRequests(
        incoming.map((r) => (seenIds.has(r.id) ? { ...r, request_seen: true } : r))
      );
      setOutgoingRequests(enriched.filter((r) => r.requester_id === user.id));
      void refreshRequestCount();
    } catch (err: unknown) {
      console.error("REQUESTS FAILED DATABASE STAGE", requestStage);
      logRequestDatabaseError(err);
      const message = getRequestErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, refreshRequestCount]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadRequests();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadRequests]);

  async function updateRequestStatus(requestId: string, newStatus: "accepted" | "declined") {
    if (!user) return;
    setUpdatingId(requestId);
    setError(null);

    try {
      const updateResult = await supabase
        .from("contact_requests")
        .update({ status: newStatus, request_seen: true })
        .eq("id", requestId)
        .eq("owner_id", user.id)
        .eq("status", "pending")
        .select("id");

      const { data: updatedRows, error: updateError } = updateResult;

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("This request is no longer pending. Refresh the page and try again.");
      }

      setIncomingRequests((prev) =>
        prev.map((item) => (item.id === requestId ? { ...item, status: newStatus, request_seen: true } : item))
      );
      void refreshRequestCount();
    } catch (err: unknown) {
      console.error("Update request status error:", err);
      const message = err instanceof Error ? err.message : "Could not update status.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function openConversation(req: RequestRecord) {
    if (!user) return;
    setOpeningId(req.id);
    setError(null);

    try {
      const otherUserId = req.owner_id === user.id ? req.requester_id : req.owner_id;

      // 1. Look for existing conversation between these two users for this listing
      const { data: conv1, error: err1 } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", req.listing_id)
        .eq("participant_one", user.id)
        .eq("participant_two", otherUserId)
        .maybeSingle();

      if (err1) throw err1;
      if (conv1?.id) {
        router.push(`/messages/${conv1.id}`);
        return;
      }

      const { data: conv2, error: err2 } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", req.listing_id)
        .eq("participant_one", otherUserId)
        .eq("participant_two", user.id)
        .maybeSingle();

      if (err2) throw err2;
      if (conv2?.id) {
        router.push(`/messages/${conv2.id}`);
        return;
      }

      // 2. Create conversation if none exists
      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          listing_id: req.listing_id,
          participant_one: user.id,
          participant_two: otherUserId,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      // Redirect to proper messages route
      router.push(`/messages/${newConv.id}`);
    } catch (err: unknown) {
      console.error("Open conversation error:", err);
      const message = err instanceof Error ? err.message : "Could not open conversation.";
      setError(message);
    } finally {
      setOpeningId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-teal-600" size={24} />
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="glass-panel max-w-md w-full rounded-3xl p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-4">
              <Inbox size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Please Log In</h2>
            <p className="mt-2 text-sm text-slate-500">
              Log in to view incoming and outgoing item exchange requests.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login?redirect=/requests"
                className="rounded-xl bg-teal-500 py-3 font-semibold text-white hover:bg-teal-600 transition"
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentList = activeTab === "incoming" ? incomingRequests : outgoingRequests;

  return (
    <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Exchange Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage incoming requests for your items and track your sent offers.
          </p>
        </div>

        {/* TABS */}
        <div className="mb-6 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("incoming")}
            className={`flex items-center gap-2 pb-3.5 px-4 text-sm font-bold border-b-2 transition ${
              activeTab === "incoming"
                ? "border-teal-500 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Inbox size={17} />
            <span>Incoming Requests</span>
            {incomingRequests.filter((r) => r.status === "pending" && !r.request_seen).length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-500 px-1.5 text-[11px] font-bold text-white">
                {incomingRequests.filter((r) => r.status === "pending" && !r.request_seen).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("outgoing")}
            className={`flex items-center gap-2 pb-3.5 px-4 text-sm font-bold border-b-2 transition ${
              activeTab === "outgoing"
                ? "border-teal-500 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Send size={16} />
            <span>Outgoing Requests</span>
            {outgoingRequests.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 px-1.5 text-[11px] font-bold">
                {outgoingRequests.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="animate-spin text-teal-600 mx-auto mb-2" size={24} />
            <p className="text-xs text-slate-500">Loading your requests...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-4">
              <Inbox size={30} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {activeTab === "incoming" ? "No Incoming Requests" : "No Outgoing Requests"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {activeTab === "incoming"
                ? "When students find your items on the campus marketplace and submit a request, it will appear here."
                : "You haven't requested any items yet. Explore the marketplace to find college essentials!"}
            </p>
            <div className="mt-6">
              <Link
                href="/marketplace"
                className="inline-flex rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map((req) => {
              const isSwap = (req.request_type || "").toLowerCase().includes("swap");
              const isIncoming = activeTab === "incoming";

              return (
                <div
                  key={req.id}
                  className="glass-elevated rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    {/* STATUS AND TYPE BADGES */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          req.status === "accepted"
                            ? "bg-teal-100 text-teal-800"
                            : req.status === "declined"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {req.status === "accepted" && <Check size={12} />}
                        {req.status === "declined" && <X size={12} />}
                        {req.status === "pending" && <Clock size={12} />}
                        <span className="capitalize">{req.status}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          isSwap ? "bg-slate-900 text-white" : "bg-teal-500 text-white"
                        }`}
                      >
                        {isSwap ? <ArrowLeftRight size={11} /> : <Gift size={11} />}
                        <span>{req.request_type}</span>
                      </span>

                      <span className="text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* ITEM TITLE */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-teal-600">
                        <Package size={20} />
                      </div>
                      <div>
                        <Link
                          href={`/marketplace/${req.listing_id}`}
                          className="font-bold text-slate-900 hover:text-teal-600 transition text-base"
                        >
                          {req.listing?.title || "Item Listing"}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {req.listing?.category || "Item"} &bull; College: {req.listing?.college_name || req.listing?.campus || "Not provided"}
                        </p>
                      </div>
                    </div>

                    {/* SWAP DETAILS IF APPLICABLE */}
                    {isSwap && (
                      <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-3.5 text-xs space-y-1">
                        {req.listing?.swap_want && (
                          <p className="text-slate-600">
                            <strong>Owner wanted:</strong> {req.listing.swap_want}
                          </p>
                        )}
                        <p className="text-teal-900 font-medium">
                          <strong>{isIncoming ? "Requester offered:" : "Your offer:"}</strong>{" "}
                          {req.offered_item || "No specific offer text provided"}
                        </p>
                      </div>
                    )}

                    {/* PERSON DETAILS */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ProfileAvatar profile={req.other_profile || null} user={null} />
                      <span>
                        {isIncoming ? "Requested by: " : "Listed by: "}
                        <strong className="text-slate-800">
                          {req.other_profile?.full_name || "Student"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-row md:flex-col gap-2 shrink-0 self-end md:self-center">
                    {isIncoming && req.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={updatingId === req.id}
                          onClick={() => updateRequestStatus(req.id, "accepted")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition disabled:opacity-50"
                        >
                          <Check size={14} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === req.id}
                          onClick={() => updateRequestStatus(req.id, "declined")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                        >
                          <X size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}

                    {req.status === "accepted" && (
                      <button
                        type="button"
                        disabled={openingId === req.id}
                        onClick={() => openConversation(req)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition disabled:opacity-50"
                      >
                        {openingId === req.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MessageCircle size={15} />
                        )}
                        <span>{isIncoming ? "Message Student" : "Message Owner"}</span>
                      </button>
                    )}

                    {req.status === "declined" && (
                      <span className="text-xs font-semibold text-slate-400 py-1">
                        Request was declined
                      </span>
                    )}

                    {isIncoming && req.status === "accepted" && (
                      <span className="text-[11px] text-teal-700 font-medium text-center">
                        ✓ Accepted
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
