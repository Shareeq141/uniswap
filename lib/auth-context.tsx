"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserProfile = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  campus?: string | null;
  department?: string | null;
  year_of_study?: number | null;
  bio?: string | null;
  show_roll_number?: boolean | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  unreadCount: number;
  requestCount: number;
  refreshProfile: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  refreshRequestCount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  unreadCount: 0,
  requestCount: 0,
  refreshProfile: async () => {},
  refreshUnreadCount: async () => {},
  refreshRequestCount: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);
  const currentUserIdRef = useRef<string | null>(null);
  const profileRequestIdRef = useRef(0);
  const authVersionRef = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, avatar_url, campus, department, year_of_study, bio, show_roll_number")
        .eq("id", userId)
        .maybeSingle();

      if (error) console.warn("Could not load user profile:", error.message);

      if (
        !error &&
        data &&
        requestId === profileRequestIdRef.current &&
        currentUserIdRef.current === userId
      ) {
        setProfile(data as UserProfile);
      }
    } catch (error) {
      console.warn("Profile load warning:", error);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      // 1. Get user conversations
      const { data: convs, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);

      if (convError || !convs || convs.length === 0) {
        if (convError) console.warn("Could not fetch conversations for unread count:", convError.message);
        if (currentUserIdRef.current === user.id) setUnreadCount(0);
        return;
      }

      const convIds = convs.map((c) => c.id);

      // 2. Count unread messages sent by the other participant
      const { count, error: msgError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      if (msgError) {
        console.warn("Could not fetch unread message count:", msgError.message);
      } else if (typeof count === "number" && currentUserIdRef.current === user.id) {
        setUnreadCount(count);
      }
    } catch (err) {
      console.warn("Could not fetch unread count:", err);
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [loadProfile, user]);

  const refreshRequestCount = useCallback(async () => {
    if (!user) {
      setRequestCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "pending")
        .eq("request_seen", false);

      if (error) {
        console.warn("Could not fetch unread request count:", error.message);
      } else if (typeof count === "number" && currentUserIdRef.current === user.id) {
        setRequestCount(count);
      }
    } catch (err) {
      console.warn("Could not fetch request count:", err);
    }
  }, [user]);

  // Initial session restoration
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const requestVersion = authVersionRef.current;
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!isMounted || requestVersion !== authVersionRef.current) return;

        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          setUser(session.user);
          loadProfile(session.user.id);
        } else {
          currentUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setUnreadCount(0);
          setRequestCount(0);
        }
      } catch (err) {
        console.warn("Auth initialization warning:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      authVersionRef.current += 1;

      if (session?.user) {
        currentUserIdRef.current = session.user.id;
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        currentUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setUnreadCount(0);
        setRequestCount(0);
      }
      setLoading(false);
    });

    void initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Update unread count when user changes
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      if (user) {
        void refreshUnreadCount();
        void refreshRequestCount();
      } else {
        setUnreadCount(0);
        setRequestCount(0);
      }
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user, refreshUnreadCount, refreshRequestCount]);

  // Realtime subscription on messages for live unread updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("realtime-unread-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          refreshUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
        },
        () => {
          void refreshRequestCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshUnreadCount, refreshRequestCount]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      currentUserIdRef.current = null;
      setProfile(null);
      setUnreadCount(0);
      setRequestCount(0);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        unreadCount,
        requestCount,
        refreshProfile,
        refreshUnreadCount,
        refreshRequestCount,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
