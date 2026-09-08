"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/marketplace";
  const redirectPath = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/marketplace";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function formatSignupError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("user already registered") || lower.includes("already registered")) {
      return "An account with this email address already exists. Please log in instead.";
    }
    if (lower.includes("password should be at least")) {
      return "Password must be at least 6 characters long.";
    }
    if (lower.includes("rate limit") || lower.includes("too many requests")) {
      return "Too many sign-up requests. Please wait a few moments before trying again.";
    }
    return msg;
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName) {
      setError("Please enter your first and last name.");
      return;
    }

    if (cleanFirstName.length > 80 || cleanLastName.length > 80) {
      setError("Names must be 80 characters or fewer.");
      return;
    }

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (cleanEmail.length > 254) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const fullName = `${cleanFirstName} ${cleanLastName}`;

    const {
      data: { user, session },
      error: signupError,
    } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          full_name: fullName,
        },
      },
    });

    if (signupError) {
      setError(formatSignupError(signupError.message));
      setLoading(false);
      return;
    }

    if (!user) {
      setError("Account could not be created. Please try again.");
      setLoading(false);
      return;
    }

    // When email confirmation is enabled, Supabase creates the user without
    // creating a session. Keep the user on this page with clear next steps.
    if (!session) {
      setSuccess("Account created. Check your email to confirm your account, then log in.");
      setLoading(false);
      return;
    }

    // Direct profile upsert as fallback for auto-trigger
    try {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          full_name: fullName,
        },
        {
          onConflict: "id",
        }
      );
    } catch (profileErr) {
      console.warn("Profile direct upsert notice:", profileErr);
    }

    setSuccess("Account created successfully! Redirecting...");

    setTimeout(() => {
      router.push(redirectPath);
    }, 1000);
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-teal-600 font-semibold text-lg"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white font-bold">
            ♻
          </span>
          UniSwap
        </Link>

        <h1 className="mt-8 text-3xl sm:text-4xl font-serif font-semibold text-slate-800">
          Create an account
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Join your campus student exchange community
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                maxLength={80}
                autoComplete="given-name"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                maxLength={80}
                autoComplete="family-name"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              College Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              maxLength={254}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              Password (min 6 characters)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-xs text-teal-800 flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3.5 text-sm font-bold text-white hover:bg-teal-600 transition shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
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
          Already have an account?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            className="font-semibold text-teal-600 hover:text-teal-700"
          >
            Log in
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        UniSwap is a free student-to-student campus exchange platform.
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#fafcfb] flex items-center justify-center px-6 py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-teal-600" size={24} />
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </main>
  );
}
