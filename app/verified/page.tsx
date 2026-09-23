"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type VerificationState = "checking" | "verified" | "session-unavailable" | "invalid";

export default function VerifiedPage() {
  const [state, setState] = useState<VerificationState>("checking");

  useEffect(() => {
    let active = true;

    async function checkVerification() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          const exchangeMessage = exchangeError.message.toLowerCase();
          const missingVerifier =
            exchangeMessage.includes("code verifier") ||
            exchangeMessage.includes("pkce") ||
            exchangeMessage.includes("flow state");

          if (active) setState(missingVerifier ? "session-unavailable" : "invalid");
          return;
        }
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;

      setState(!error && !!user?.email_confirmed_at ? "verified" : "invalid");
    }

    void checkVerification();

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
        <div className="glass-panel flex w-full max-w-md items-center justify-center rounded-3xl p-10 shadow-xs">
          <Loader2 className="animate-spin text-teal-600" size={28} aria-label="Checking verification" />
        </div>
      </main>
    );
  }

  if (state === "invalid") {
    return (
      <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center shadow-xs">
          <AlertCircle className="mx-auto text-slate-700" size={32} />
          <h1 className="mt-5 text-2xl font-serif font-semibold text-slate-800">Verification unsuccessful</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This page is only available after Supabase confirms your email address.
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
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center shadow-xs sm:p-10">
        <CheckCircle2 className="mx-auto text-teal-700" size={40} strokeWidth={1.8} />
        <h1 className="mt-5 text-3xl font-serif font-semibold text-slate-800">Verified</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Your email has been successfully verified.</p>
        <Link href="/marketplace" className="glass-button mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold">
          <span>Continue to UniSwap</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
