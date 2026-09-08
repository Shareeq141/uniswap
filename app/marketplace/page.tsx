"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftRight,
  Gift,
  GraduationCap,
  Heart,
  Navigation,
  PackageOpen,
  Search,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isSafePublicImageUrl } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import LiveLocationControl, { LiveLocation } from "@/components/LiveLocationControl";

export type Listing = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  exchange_type?: string | null;
  type?: string | null;
  swap_want?: string | null;
  campus?: string | null;
  college_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  status?: string | null;
  owner_id?: string | null;
  created_at?: string | null;
  owner_name?: string;
};

const categories = ["All", "Calculators", "Textbooks", "Stationery", "Drafting Tools", "Lab Equipment", "Lab Coats", "Electronics", "Other"];
const conditions = ["All", "New", "Like New", "Good", "Fair", "Used"];
const LOCATION_RADIUS_KM = 1.5;

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

function safeSearchTerm(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizeCoordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= minimum && numericValue <= maximum
    ? numericValue
    : null;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");
  const [exchangeFilter, setExchangeFilter] = useState<"All" | "Give Away" | "Swap">("All");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<LiveLocation | null>(null);
  const latestRequestRef = useRef(0);

  const loadListings = useCallback(async (searchQuery: string, location: LiveLocation | null) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const term = safeSearchTerm(searchQuery);
      let data: Listing[] | null = null;
      let listingsError: { message: string } | null = null;

      if (location && !term) {
        const nearby = await supabase.rpc("get_nearby_listings", {
          user_lat: location.latitude,
          user_lon: location.longitude,
          radius_km: LOCATION_RADIUS_KM,
        });
        if (!nearby.error) {
          data = (nearby.data || []) as Listing[];
        } else {
          console.warn("Nearby listings RPC unavailable; falling back to available listings.", nearby.error);
        }
      }

      // An empty RPC response is still a valid response, but querying the
      // published listings lets the client distinguish a genuinely empty
      // radius from a stale/unapplied nearby RPC without inventing data.
      if (!data || (location && !term && data.length === 0)) {
        let query = supabase.from("listings").select("*").eq("status", "available").order("created_at", { ascending: false });
        if (term) {
          const pattern = `%${term}%`;
          query = query.or(`title.ilike.${pattern},description.ilike.${pattern},college_name.ilike.${pattern},campus.ilike.${pattern}`);
        }
        const result = await query;
        data = (result.data || []) as Listing[];
        listingsError = result.error;
      }

      if (listingsError) throw listingsError;

      const rows = (data || []).map((item) => ({
        ...item,
        latitude: normalizeCoordinate(item.latitude, -90, 90),
        longitude: normalizeCoordinate(item.longitude, -180, 180),
      }));
      const ownerIds = Array.from(new Set(rows.map((item) => item.owner_id).filter(Boolean))) as string[];
      let profileMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
        if (profilesError) throw profilesError;
        if (profiles) profileMap = Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name?.trim() || "Student"]));
      }

      if (requestId !== latestRequestRef.current) return;
      setListings(rows.map((item) => ({ ...item, owner_name: item.owner_id ? profileMap[item.owner_id] || "Student" : "Student" })));
    } catch (err: unknown) {
      if (requestId !== latestRequestRef.current) return;
      console.error("Marketplace fetch error:", err);
      setListings([]);
      setError(err instanceof Error ? err.message : "Could not load marketplace listings.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadListings(search, userLocation), search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadListings, search, userLocation]);

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const matchesCategory = selectedCategory === "All" || (item.category || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchesCondition = selectedCondition === "All" || (item.condition || "").toLowerCase() === selectedCondition.toLowerCase();
      const itemType = (item.exchange_type || item.type || "").toLowerCase();
      const matchesExchange = exchangeFilter === "All" || (exchangeFilter === "Give Away" && itemType.includes("give")) || (exchangeFilter === "Swap" && itemType.includes("swap"));
      const hasValidCoordinates = typeof item.latitude === "number" && Number.isFinite(item.latitude) && typeof item.longitude === "number" && Number.isFinite(item.longitude);
      const matchesLocation = !userLocation || (hasValidCoordinates && calculateDistanceKm(userLocation.latitude, userLocation.longitude, item.latitude as number, item.longitude as number) <= LOCATION_RADIUS_KM);
      return matchesCategory && matchesCondition && matchesExchange && matchesLocation;
    });
  }, [exchangeFilter, listings, selectedCategory, selectedCondition, userLocation]);

  function toggleSaved(id: string) {
    setSavedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  return (
    <div className="min-h-screen bg-[#fbfcfa] flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-3xl border border-teal-100 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-50 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-xs"><Sparkles size={14} /> Campus Student Marketplace</div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Find what you need. <span className="text-teal-600">Give what you don&apos;t.</span></h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Search by item, description, or college. Nearby matching uses one-time browser location only.</p>
            </div>
            <Link href="/give" className="inline-flex self-start items-center gap-2 rounded-2xl bg-teal-500 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600"><Gift size={18} /> List an Item</Link>
          </div>
          <div className="mt-5 max-w-md"><LiveLocationControl value={userLocation} onChange={setUserLocation} compact /></div>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" aria-label="Search campus items" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items, descriptions, or college names..." className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none shadow-2xs transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
            {(["All", "Give Away", "Swap"] as const).map((type) => <button key={type} type="button" onClick={() => setExchangeFilter(type)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${exchangeFilter === type ? "bg-teal-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>{type === "Give Away" && <Gift size={13} className="mr-1 inline" />}{type === "Swap" && <ArrowLeftRight size={13} className="mr-1 inline" />}{type}</button>)}
          </div>
        </div>

        <div className="mb-6 overflow-x-auto pb-1"><div className="flex min-w-max gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${selectedCategory === category ? "bg-teal-500 text-white shadow-xs" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{category}</button>)}</div></div>
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1"><span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-400">Condition:</span>{conditions.map((condition) => <button key={condition} type="button" onClick={() => setSelectedCondition(condition)} className={`rounded-lg px-3 py-1 text-xs font-medium transition ${selectedCondition === condition ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{condition}</button>)}</div>

        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Available Items ({filteredListings.length})</h2>{userLocation && <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700"><Navigation size={13} /> Within 1.5 km</span>}</div>
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p className="font-semibold">Could not load items</p><p className="mt-1">{error}</p><button type="button" onClick={() => void loadListings(search, userLocation)} className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">Retry</button></div>}

        {loading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((number) => <div key={number} className="h-80 animate-pulse rounded-3xl border border-slate-100 bg-white p-4"><div className="mb-4 h-40 rounded-2xl bg-slate-100" /><div className="mb-2 h-4 w-3/4 rounded-lg bg-slate-100" /><div className="mb-4 h-3 w-1/2 rounded-lg bg-slate-100" /><div className="h-8 w-full rounded-xl bg-slate-100" /></div>)}</div> : filteredListings.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600"><PackageOpen size={32} /></div><h3 className="text-xl font-bold text-slate-900">{userLocation ? "No Nearby Listings Found" : "No Listings Found"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{userLocation ? "No available listing with saved coordinates is within 1.5 km of your current browser location. Listings without latitude/longitude are excluded from nearby results. Turn off Live Location to browse all available listings." : "Try a different item or college search, clear the filters, or publish the first listing."}</p><button type="button" onClick={() => { setSearch(""); setSelectedCategory("All"); setSelectedCondition("All"); setExchangeFilter("All"); }} className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Reset Filters</button></div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filteredListings.map((item) => {
          const isGiveAway = (item.exchange_type || item.type || "").toLowerCase().includes("give");
          const college = item.college_name || item.campus || "College not provided";
          const isSaved = savedIds.includes(item.id);
          const imageUrl = isSafePublicImageUrl(item.images?.[0]) ? item.images[0] : null;
          return <article key={item.id} className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xs transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden bg-slate-100">{imageUrl ? <Image src={imageUrl} alt={item.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-300 group-hover:scale-105" /> : <div className="text-5xl">{(item.category || "").toLowerCase().includes("calc") ? "🧮" : (item.category || "").toLowerCase().includes("book") ? "📚" : (item.category || "").toLowerCase().includes("lab") ? "🥼" : (item.category || "").toLowerCase().includes("draft") ? "📐" : (item.category || "").toLowerCase().includes("elect") ? "💻" : "📦"}</div>}<span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${isGiveAway ? "bg-teal-500 text-white" : "bg-slate-900 text-white"}`}>{isGiveAway ? "Give Away" : "Swap"}</span><button type="button" onClick={() => toggleSaved(item.id)} aria-label="Save listing" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-xs transition hover:text-red-500"><Heart size={16} className={isSaved ? "fill-red-500 text-red-500" : ""} /></button></div>
            <div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-1 text-base font-bold text-slate-900">{item.title}</h3>{item.condition && <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.condition}</span>}</div>{!isGiveAway && item.swap_want && <div className="mt-2.5 rounded-xl border border-teal-100 bg-teal-50/80 p-2 text-xs"><span className="font-bold text-teal-800">What I Want: </span><span className="text-teal-900">{item.swap_want}</span></div>}<p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{item.description || "No description provided."}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><div className="flex items-start gap-1.5"><GraduationCap size={14} className="mt-0.5 shrink-0 text-teal-600" /><span className="line-clamp-2"><strong className="text-slate-700">College:</strong> {college}</span></div><div className="text-slate-700">Listed by {item.owner_name}</div></div><Link href={`/marketplace/${item.id}`} className="mt-3 block w-full rounded-xl bg-slate-900 py-2.5 text-center text-xs font-bold text-white transition hover:bg-slate-800">View Details</Link></div>
          </article>;
        })}</div>}
      </main>
    </div>
  );
}
