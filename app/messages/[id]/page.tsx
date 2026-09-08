"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Package,
  Loader2,
  AlertCircle,
  CheckCheck,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type ConversationInfo = {
  id: string;
  listing_id: string | null;
  participant_one: string;
  participant_two: string;
  other_name: string;
  listing_title?: string;
};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, refreshUnreadCount } = useAuth();

  const rawId = params?.id;
  const conversationId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Initial load
  useEffect(() => {
    if (!conversationId || !user) return;

    let isMounted = true;

    async function loadConversationAndMessages() {
      setLoading(true);
      setError(null);
      setMessages([]);

      try {
        // 1. Fetch conversation
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .select("id, listing_id, participant_one, participant_two, created_at")
          .eq("id", conversationId)
          .single();

        if (convError || !conv) {
          throw new Error("Conversation not found or access denied.");
        }

        // Verify participant
        if (conv.participant_one !== user!.id && conv.participant_two !== user!.id) {
          throw new Error("You are not a participant in this conversation.");
        }

        const otherUserId =
          conv.participant_one === user!.id ? conv.participant_two : conv.participant_one;

        // Fetch other person's profile
        let otherName = "Student";
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", otherUserId)
          .maybeSingle();

        if (profileError) console.warn("Could not load conversation profile:", profileError.message);

        if (profile?.full_name) {
          otherName = profile.full_name.trim();
        }

        // Fetch listing title if present
        let listingTitle: string | undefined;
        if (conv.listing_id) {
          const { data: listing, error: listingError } = await supabase
            .from("listings")
            .select("title")
            .eq("id", conv.listing_id)
            .maybeSingle();

          if (listingError) console.warn("Could not load conversation listing:", listingError.message);

          if (listing) {
            listingTitle = listing.title;
          }
        }

        if (!isMounted) return;

        setConversation({
          ...conv,
          other_name: otherName,
          listing_title: listingTitle,
        });

        // 2. Fetch messages
        const { data: messageRows, error: msgError } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at, is_read")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;

        const loaded = (messageRows || []) as Message[];
        if (isMounted) {
          setMessages((previous) => {
            const merged = new Map(previous.map((message) => [message.id, message]));
            loaded.forEach((message) => {
              merged.set(message.id, { ...merged.get(message.id), ...message });
            });
            return Array.from(merged.values()).sort(
              (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
            );
          });
        }

        // 3. Mark incoming unread messages as read in Supabase
        const { error: readError } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversationId)
          .neq("sender_id", user!.id)
          .eq("is_read", false);

        if (readError) {
          console.warn("Error marking messages as read:", readError);
        } else {
          // Immediately update local messages state
          if (isMounted) {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender_id !== user!.id ? { ...m, is_read: true } : m
              )
            );
          }
          // Refresh navbar badge count immediately!
          void refreshUnreadCount();
        }
      } catch (err: unknown) {
        console.error("Conversation load error:", err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Could not load this conversation.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setTimeout(scrollToBottom, 100);
        }
      }
    }

    loadConversationAndMessages();

    return () => {
      isMounted = false;
    };
  }, [conversationId, user, refreshUnreadCount]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!conversationId || !user) return;

    let isMounted = true;

    const channel = supabase
      .channel(`conversation-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const newMsg = payload.new as Message;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });

          setTimeout(scrollToBottom, 50);

          // If incoming message from other student, mark as read immediately since conversation is open
          if (newMsg.sender_id !== user.id) {
            const { error: readError } = await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMsg.id);

            if (!readError && isMounted) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === newMsg.id ? { ...m, is_read: true } : m
                )
              );

              // Update badge
              void refreshUnreadCount();
            } else if (readError) {
              console.warn("Could not mark realtime message as read:", readError.message);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, refreshUnreadCount]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const text = inputText.trim();
    if (!text || !user || !conversationId || sending) return;

    setSending(true);
    setInputText("");

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: text,
          is_read: false,
        })
        .select("id, conversation_id, sender_id, content, created_at, is_read")
        .single();

      if (insertError) throw insertError;

      if (inserted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === inserted.id)) return prev;
          return [...prev, inserted as Message];
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (err: unknown) {
      console.error("Send message error:", err);
      const message = err instanceof Error ? err.message : "Failed to send message. Please try again.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-[#fafcfb] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-4">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Please Log In</h2>
            <p className="mt-2 text-sm text-slate-500">
              You must be logged in to view this conversation.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/messages/${conversationId}`)}`}
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
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl flex flex-col px-4 sm:px-6 py-4 sm:py-6">
        {/* CHAT CONTAINER */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* CHAT HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/messages")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                aria-label="Back to messages"
              >
                <ArrowLeft size={16} />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 font-bold text-base">
                  {conversation?.other_name ? conversation.other_name.charAt(0).toUpperCase() : "S"}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm leading-none">
                    {conversation?.other_name || "Student"}
                  </h2>
                  {conversation?.listing_title && (
                    <div className="flex items-center gap-1 text-[11px] text-teal-700 font-medium mt-1">
                      <Package size={11} className="shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        {conversation.listing_title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {conversation?.listing_id && (
              <Link
                href={`/marketplace/${conversation.listing_id}`}
                className="hidden sm:inline-flex text-xs font-semibold text-teal-600 hover:underline"
              >
                View Listing &rarr;
              </Link>
            )}
          </div>

          {/* MESSAGES SCROLL AREA */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[380px] max-h-[60vh] bg-slate-50/50">
            {loading ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <Loader2 className="animate-spin text-teal-600" size={24} />
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-3">
                  <Package size={24} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Coordinate On-Campus Exchange</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Agree on a safe campus meeting spot (e.g. library, cafeteria, department lounge) and convenient time.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                        isMe
                          ? "bg-teal-600 text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 px-1">
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isMe && (
                        <CheckCheck
                          size={12}
                          className={msg.is_read ? "text-teal-600" : "text-slate-300"}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* CHAT INPUT */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-100 bg-white p-3 sm:p-4 flex items-center gap-2"
          >
            <input
              type="text"
              aria-label="Message text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message to coordinate pickup..."
              maxLength={1000}
              disabled={loading || sending || !user}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs sm:text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
            />

            <button
              type="submit"
              disabled={loading || sending || !inputText.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-white shadow-xs hover:bg-teal-600 transition disabled:opacity-50 shrink-0"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
