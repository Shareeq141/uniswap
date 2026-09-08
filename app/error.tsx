"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log non-sensitive error info for debugging
    console.error("UniSwap Application Error:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
          <AlertTriangle size={32} />
        </div>

        <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {error.message && !error.message.includes("digest")
            ? error.message
            : "An unexpected error occurred while loading this page. Please try again or return to the marketplace."}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition shadow-xs"
          >
            <RefreshCw size={16} />
            <span>Try again</span>
          </button>

          <Link
            href="/marketplace"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Home size={16} />
            <span>Marketplace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
