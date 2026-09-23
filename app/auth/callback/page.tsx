"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CallbackState = "checking" | "session-unavailable" | "error";

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("checking");

  useEffect(() => {
    let active = true;

    async function completeConfirmation() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const callbackError = params.get("error") || params.get("error_code");

      if (callbackError || !code) {
        if (active) setState("error");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!userError && user?.email_confirmed_at) {
          window.location.replace("/verified");
          return;
        }
      }

      // Without the original verifier, no client session can be created in
      // this browser. Keep this neutral and do not claim a verified session.
      const exchangeMessage = exchangeError?.message.toLowerCase() || "";
      const missingVerifier =
        exchangeMessage.includes("code verifier") ||
        exchangeMessage.includes("pkce") ||
        exchangeMessage.includes("flow state");

      if (active) {
        setState(missingVerifier ? "session-unavailable" : "error");
      }
    }

    void completeConfirmation();

    return () => {
      active = false;
    };
  }, []);

  if (state === "error") {
    return (
      <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center shadow-xs">
          <AlertCircle className="mx-auto text-slate-700" size={32} />
          <h1 className="mt-5 text-2xl font-serif font-semibold text-slate-800">Verification link unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This verification link is invalid or has expired. Please request a new verification email.
          </p>
          <Link href="/login" className="glass-button mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold">
            Continue to UniSwap
          </Link>
        </div>
      </main>
    );
  }

  if (state === "session-unavailable") {
    return (
      <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center shadow-xs">
          <h1 className="text-2xl font-serif font-semibold text-slate-800">Continue in UniSwap</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            This email link was opened in a different browser context, so Supabase could not create a session here. Return to the browser where you started signup, or sign in to continue.
          </p>
          <Link href="/login" className="glass-button mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold">
            Sign in to UniSwap
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
      <div className="glass-panel flex w-full max-w-md items-center justify-center rounded-3xl p-10 shadow-xs">
        <Loader2 className="animate-spin text-teal-600" size={28} aria-label="Completing email confirmation" />
      </div>
    </main>
  );
}
