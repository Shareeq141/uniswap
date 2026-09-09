"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Calculator,
  Gift,
  Laptop,
  Loader2,
  MapPin,
  PackageOpen,
  Recycle,
  Shirt,
  Sparkles,
  Wrench,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isSafePublicImageUrl } from "@/lib/utils";
import type { Listing } from "@/app/marketplace/page";

const categories = [
  {
    name: "Calculators",
    icon: Calculator,
  },
  {
    name: "Textbooks",
    icon: BookOpen,
  },
  {
    name: "Electronics",
    icon: Laptop,
  },
  {
    name: "Clothing",
    icon: Shirt,
  },
  {
    name: "Tools",
    icon: Wrench,
  },
  {
    name: "Other",
    icon: Recycle,
  },
];

export default function Home() {
  const { user } = useAuth();
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number | null>>({});
  const [featuredListing, setFeaturedListing] = useState<Listing | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedListing() {
      setFeaturedLoading(true);
      setFeaturedError(null);

      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      if (error) {
        setFeaturedListing(null);
        setFeaturedError(error.message);
      } else {
        setFeaturedListing((data?.[0] as Listing | undefined) || null);
      }

      setFeaturedLoading(false);
    }

    void loadFeaturedListing();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCategoryCounts() {
      const results = await Promise.all(
        categories.map(async (category) => {
          const { count, error } = await supabase
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("status", "available")
            .eq("category", category.name);

          return [category.name, error ? null : count ?? 0] as const;
        }),
      );

      if (!cancelled) {
        setCategoryCounts(Object.fromEntries(results));
      }
    }

    void loadCategoryCounts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f9] text-slate-900">
      <Navbar />

      {/* HERO */}
      <section className="glass-panel mx-3 mt-8 grid max-w-7xl gap-12 px-6 py-16 sm:mx-auto sm:px-10 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <div className="glass-pill mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700">
            <Sparkles size={16} />
            The free student-to-student marketplace
          </div>

          <h1 className="text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
            Give what you don&apos;t need.
            <span className="text-teal-400"> Find what you do.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">
            UniSwap helps students give away or swap useful college items with
            other students — completely free and right on campus.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/marketplace"
              className="glass-button inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold"
            >
              Start Swiping
              <ArrowRight size={18} />
            </Link>

            <Link
              href={user ? "/give" : "/login"}
              className="glass-control rounded-xl px-6 py-3.5 font-semibold text-slate-700 hover:bg-white/40"
            >
              Give an Item
            </Link>
          </div>

        </div>

        {/* FEATURE CARD */}
        <div className="glass-elevated rounded-3xl p-5 shadow-sm">
          {featuredLoading ? (
            <div className="glass-surface flex min-h-[28rem] flex-col items-center justify-center rounded-2xl p-8 text-center">
              <Loader2 className="animate-spin text-teal-600" size={28} />
              <p className="mt-3 text-sm text-slate-500">Loading available listings...</p>
            </div>
          ) : featuredError ? (
            <div className="glass-surface flex min-h-[28rem] flex-col items-center justify-center rounded-2xl p-8 text-center">
              <PackageOpen className="text-slate-400" size={34} />
              <h2 className="mt-4 text-xl font-semibold">Listings are unavailable right now</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">{featuredError}</p>
              <Link href="/marketplace" className="glass-control mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700">
                Browse Marketplace
              </Link>
            </div>
          ) : !featuredListing ? (
            <div className="glass-surface flex min-h-[28rem] flex-col items-center justify-center rounded-2xl p-8 text-center">
              <PackageOpen className="text-slate-400" size={34} />
              <h2 className="mt-4 text-xl font-semibold">No listings yet</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Be the first student to share something with your campus.
              </p>
              <Link
                href={user ? "/give" : "/login"}
                className="glass-button mt-6 rounded-xl px-5 py-3 text-sm font-semibold"
              >
                Give an Item
              </Link>
            </div>
          ) : (
            <Link href={`/marketplace/${featuredListing.id}`} className="glass-surface group block overflow-hidden rounded-2xl">
              <div className="relative flex h-80 items-center justify-center overflow-hidden bg-slate-100">
                {isSafePublicImageUrl(featuredListing.images?.[0]) ? (
                  <Image
                    src={featuredListing.images[0]}
                    alt={featuredListing.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <PackageOpen className="text-slate-400" size={72} strokeWidth={1.25} />
                )}
                {(featuredListing.exchange_type || featuredListing.type) && (
                  <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-900">
                    {(featuredListing.exchange_type || featuredListing.type || "").toLowerCase().includes("swap") ? <ArrowLeftRight size={15} /> : <Gift size={15} />}
                    {featuredListing.exchange_type || featuredListing.type}
                  </span>
                )}
              </div>

              <div className="p-6">
                <h2 className="line-clamp-2 text-2xl font-semibold">{featuredListing.title}</h2>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                  {featuredListing.condition && <span>{featuredListing.condition}</span>}
                  {featuredListing.category && <span>{featuredListing.category}</span>}
                </div>

                {featuredListing.description && (
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">{featuredListing.description}</p>
                )}

                {(featuredListing.college_name || featuredListing.campus) && (
                  <p className="mt-4 flex items-start gap-2 text-sm font-medium text-teal-700">
                    <MapPin size={16} className="mt-0.5 shrink-0" />
                    <span>{featuredListing.college_name || featuredListing.campus}</span>
                  </p>
                )}

                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Available listing</span>
                  <span className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
                    View listing
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-t border-white/60 bg-[#eef0f2] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="font-medium text-teal-500">Browse</p>

              <h2 className="mt-2 text-4xl font-semibold">
                Find what you need
              </h2>

              <p className="mt-3 text-slate-500">
                Useful things from students around your campus.
              </p>
            </div>

            <Link
              href="/marketplace"
              className="hidden items-center gap-2 font-semibold text-teal-500 md:flex"
            >
              View all
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon;

              return (
                <Link
                  key={category.name}
                  href="/marketplace"
                  className="glass-elevated group rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-500">
                      <Icon size={24} />
                    </div>

                    <ArrowRight
                      size={20}
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-400"
                    />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold">
                    {category.name}
                  </h3>

                  {typeof categoryCounts[category.name] === "number" && (
                    <p className="mt-1 text-sm text-slate-400">
                      {categoryCounts[category.name]} {categoryCounts[category.name] === 1 ? "item" : "items"}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-medium text-teal-500">Simple & free</p>

            <h2 className="mt-2 text-4xl font-semibold">
              How UniSwap works
            </h2>

            <p className="mt-4 text-slate-500">
              Exchange useful college items directly with students on campus.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="glass-surface rounded-2xl p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-xl font-bold text-teal-500">
                1
              </div>

              <h3 className="mt-5 text-xl font-semibold">
                Find an item
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Browse useful items shared by students at your campus.
              </p>
            </div>

            <div className="glass-surface rounded-2xl p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-xl font-bold text-teal-500">
                2
              </div>

              <h3 className="mt-5 text-xl font-semibold">
                Contact the student
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Connect directly with the person who has the item.
              </p>
            </div>

            <div className="glass-surface rounded-2xl p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-xl font-bold text-teal-500">
                3
              </div>

              <h3 className="mt-5 text-xl font-semibold">
                Exchange on campus
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Meet safely on campus and exchange the item directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© 2026 UniSwap. Free student-to-student exchange.</p>

          <div className="flex gap-6">
            <Link href="/marketplace" className="hover:text-teal-500">
              Explore
            </Link>

            <Link
              href={user ? "/give" : "/login"}
              className="hover:text-teal-500"
            >
              Give an Item
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
