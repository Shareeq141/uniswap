"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Heart,
  Laptop,
  Recycle,
  Shirt,
  Sparkles,
  Wrench,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

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
    <main className="min-h-screen bg-[#f7f7f3] text-slate-900">
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
          <div className="glass-surface overflow-hidden rounded-2xl">
            <div className="relative flex h-80 items-center justify-center bg-slate-100">
              <span className="absolute left-5 top-5 rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-white">
                GIVE AWAY
              </span>

              <div className="flex h-48 w-48 items-center justify-center rounded-2xl border-4 border-amber-700 bg-amber-100 shadow-lg">
                <Calculator size={110} strokeWidth={1.5} />
              </div>
            </div>

            <div className="p-6">
              <h2 className="text-2xl font-semibold">
                Casio FX-991ES Plus
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Like New • CSE • 3rd Year
              </p>

              <p className="mt-4 font-medium text-teal-600">
                Free for a student who needs it
              </p>

              <div className="mt-6 flex justify-center gap-4">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                >
                  ×
                </button>

                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-400 text-white"
                >
                  <Heart size={20} fill="currentColor" />
                </button>

                <Link
                  href="/marketplace"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                >
                  <ArrowRight size={20} />
                </Link>
              </div>

              <p className="mt-4 text-center text-xs text-slate-400">
                Swipe through items • No payments
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-t border-white/60 bg-[#f1f3ee] py-20">
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
