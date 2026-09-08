import Link from "next/link";
import { Search, Home } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-50 text-teal-600 text-3xl font-extrabold mb-4">
            404
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            The page or listing you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/marketplace"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition shadow-xs"
            >
              <Search size={16} />
              <span>Explore Marketplace</span>
            </Link>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Home size={16} />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
