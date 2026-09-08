import Link from "next/link";
import { MessageSquareOff, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function ConversationNotFound() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <MessageSquareOff size={32} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Conversation Not Found</h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            This conversation does not exist or you do not have permission to view it.
          </p>

          <div className="mt-6">
            <Link
              href="/messages"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Back to Messages</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
