"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Package,
  ChevronRight,
  Loader2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type UserProfile } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import ProfileAvatar from "@/components/ProfileAvatar";

type ConversationItem = {
  id: string;
  listing_id: string | null;
  participant_one: string;
  participant_two: string;
  created_at: string;
  other_name: string;
  other_profile: UserProfile;
  listing_title?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
};

export default function MessagesIndexPage() {
  const { user, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSequenceRef = useRef(0);
  const componentMountedRef = useRef(true);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    let isMounted = true;
    const fetchSequence = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = fetchSequence;
    setLoading(true);
    setError(null);

    try {
        // 1. Fetch conversations for this user
        const { data: convData, error: convError } = await supabase
          .from("conversations")
          .select("id, listing_id, participant_one, participant_two, created_at")
          .or(`participant_one.eq.${user!.id},participant_two.eq.${user!.id}`)
          .order("created_at", { ascending: false });

        if (convError) throw convError;

        const rawConvs = convData || [];
        if (rawConvs.length === 0) {
          if (componentMountedRef.current && fetchSequence === fetchSequenceRef.current) {
            setConversations([]);
          }
          return;
        }

        const convIds = rawConvs.map((c) => c.id);
        const listingIds = Array.from(new Set(rawConvs.map((c) => c.listing_id).filter(Boolean))) as string[];
        const otherUserIds = Array.from(
          new Set(
            rawConvs.map((c) =>
              c.participant_one === user!.id ? c.participant_two : c.participant_one
            )
          )
        );

        // 2. Fetch profiles
        const profileMap = new Map<string, UserProfile>();
        if (otherUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", otherUserIds);

          if (profilesError) throw profilesError;

          if (profiles) {
            profiles.forEach((p) => profileMap.set(p.id, p as UserProfile));
          }
        }

        // 3. Fetch listings
        const listingMap = new Map<string, string>();
        if (listingIds.length > 0) {
          const { data: listings, error: listingsError } = await supabase
            .from("listings")
            .select("id, title")
            .in("id", listingIds);

          if (listingsError) throw listingsError;

          if (listings) {
            listings.forEach((l) => listingMap.set(l.id, l.title));
          }
        }

        // 4. Fetch last message and unread count for each conversation
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at, is_read")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });

        if (messagesError) throw messagesError;

        const lastMessageMap = new Map<string, { content: string; time: string }>();
        const unreadMap = new Map<string, number>();

        if (messages) {
          messages.forEach((msg) => {
            // Record last message (first encountered since ordered desc)
            if (!lastMessageMap.has(msg.conversation_id)) {
              lastMessageMap.set(msg.conversation_id, {
                content: msg.content,
                time: msg.created_at,
              });
            }

            // Count unread if incoming
            if (msg.sender_id !== user!.id && !msg.is_read) {
              unreadMap.set(
                msg.conversation_id,
                (unreadMap.get(msg.conversation_id) || 0) + 1
              );
            }
          });
        }

        const enriched: ConversationItem[] = rawConvs.map((c) => {
          const otherId = c.participant_one === user!.id ? c.participant_two : c.participant_one;
          const lastMsg = lastMessageMap.get(c.id);

          return {
            ...c,
            other_name: profileMap.get(otherId)?.full_name?.trim() || "Student",
            other_profile: profileMap.get(otherId) || { id: otherId, full_name: "Student", avatar_url: null },
            listing_title: c.listing_id ? listingMap.get(c.listing_id) : undefined,
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.time || c.created_at,
            unread_count: unreadMap.get(c.id) || 0,
          };
        });

        if (componentMountedRef.current && isMounted && fetchSequence === fetchSequenceRef.current) {
          setConversations(enriched);
        }
      } catch (err: unknown) {
        console.error("Messages list error:", err);
        if (componentMountedRef.current && isMounted && fetchSequence === fetchSequenceRef.current) {
          const message = err instanceof Error ? err.message : "Could not load conversations.";
          setError(message);
        }
    } finally {
      if (componentMountedRef.current && isMounted && fetchSequence === fetchSequenceRef.current) {
        setLoading(false);
      }
    }
    isMounted = false;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const initialLoadTimer = window.setTimeout(() => {
      void fetchConversations();
    }, 0);

    const channel = supabase
      .channel("messages-index-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          void fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          void fetchConversations();
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

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
              <MessageSquare size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Please Log In</h2>
            <p className="mt-2 text-sm text-slate-500">
              Log in to view your campus conversations with students.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login?redirect=/messages"
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

  return (
    <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Messages</h1>
            <p className="mt-1 text-sm text-slate-500">
              Active campus exchanges and chats with other students.
            </p>
          </div>
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
            <p className="text-xs text-slate-500">Loading your conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-4">
              <Inbox size={30} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Messages Yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              When an item request is accepted, a private conversation opens here to coordinate campus pickup.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/marketplace"
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition"
              >
                Browse Marketplace
              </Link>
              <Link
                href="/requests"
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                View Requests
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="glass-elevated w-full rounded-2xl p-4 sm:p-5 text-left transition flex items-center justify-between gap-4 shadow-2xs group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* AVATAR */}
                  <Link
                    href={`/profile/${conv.other_profile.id}`}
                    aria-label={`View ${conv.other_name}'s profile`}
                    className="shrink-0"
                  >
                    <ProfileAvatar profile={conv.other_profile} user={null} />
                  </Link>

                  {/* DETAILS */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/profile/${conv.other_profile.id}`}
                        className="truncate font-bold text-sm text-slate-900 hover:text-teal-600"
                      >
                        {conv.other_name}
                      </Link>
                      {conv.unread_count > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/messages/${conv.id}`}
                      className="block min-w-0"
                    >
                    {conv.listing_title && (
                      <div className="flex items-center gap-1 text-xs text-teal-700 font-medium truncate mt-0.5">
                        <Package size={12} className="shrink-0" />
                        <span className="truncate">{conv.listing_title}</span>
                      </div>
                    )}

                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {conv.last_message || "Start the conversation..."}
                    </p>
                    </Link>
                  </div>
                </div>

                {/* TIMESTAMP & ARROW */}
                <Link href={`/messages/${conv.id}`} className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400">
                    {new Date(conv.last_message_time || conv.created_at).toLocaleDateString()}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-teal-600"
                  />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
