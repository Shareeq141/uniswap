"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/marketplace";
  // Protect against open redirect attacks
  const redirectPath = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/marketplace";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function formatErrorMessage(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
      return "Incorrect email or password. Please double-check and try again.";
    }
    if (lower.includes("email not confirmed")) {
      return "Your email address has not been confirmed yet. Please check your inbox for the confirmation link.";
    }
    if (lower.includes("too many requests") || lower.includes("rate limit")) {
      return "Too many sign-in attempts. Please wait a few moments before trying again.";
    }
    return msg;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(formatErrorMessage(error.message));
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Login succeeded, but no session was created. Please try again.");
      setLoading(false);
      return;
    }

    // Go to intended destination or marketplace
    router.push(redirectPath);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-teal-600 font-semibold text-lg"
        >
          <span className="glass-bubble flex h-9 w-9 items-center justify-center rounded-xl text-teal-800 font-bold">
            ♻
          </span>
          UniSwap
        </Link>

        <h1 className="mt-8 text-3xl sm:text-4xl font-serif font-semibold text-slate-800">
          Welcome back
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Enter your student account details to continue
        </p>
      </div>

      <div className="glass-panel rounded-3xl p-8 shadow-xs">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              maxLength={254}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-button w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Log In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
            className="font-semibold text-teal-600 hover:text-teal-700"
          >
            Sign up
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        UniSwap is a free student-to-student campus exchange platform.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f3] flex items-center justify-center px-6 py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-teal-600" size={24} />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
