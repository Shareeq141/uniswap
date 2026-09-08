export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
          <span className="text-2xl animate-spin">♻</span>
        </div>
        <div className="space-y-2 w-full">
          <div className="h-4 bg-slate-200 rounded-full w-2/3 mx-auto animate-pulse" />
          <div className="h-3 bg-slate-100 rounded-full w-1/2 mx-auto animate-pulse" />
        </div>
        <p className="text-xs text-slate-400">Loading UniSwap...</p>
      </div>
    </div>
  );
}
