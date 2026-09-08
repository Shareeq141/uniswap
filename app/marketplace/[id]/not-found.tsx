import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function ListingNotFound() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <PackageX size={32} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Item Not Found</h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            This listing is no longer available or was removed by the owner. Browse other campus items in the marketplace!
          </p>

          <div className="mt-6">
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
