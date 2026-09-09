"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  Inbox,
  MessageSquare,
  PlusCircle,
  Menu,
  X,
  LogOut,
  LogIn,
  UserPlus,
  List,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import ProfileAvatar from "@/components/ProfileAvatar";

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile, loading, unreadCount, requestCount, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    ...(user
      ? [
          {
            name: "My Listings",
            href: "/my-listings",
            icon: List,
          },
        ]
      : []),
    {
      name: "Marketplace",
      href: "/marketplace",
      icon: ShoppingBag,
    },
    {
      name: "Requests",
      href: "/requests",
      icon: Inbox,
      badge: requestCount,
    },
    {
      name: "Messages",
      href: "/messages",
      icon: MessageSquare,
      badge: unreadCount,
    },
    {
      name: "Give an Item",
      href: user ? "/give" : "/login",
      icon: PlusCircle,
      highlight: true,
    },
  ];

  return (
    <nav className="glass-panel sticky top-3 z-50 mx-3 rounded-2xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="glass-bubble flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-105">
            <Image
              src="/uniswap-logo.png"
              alt="UniSwap logo"
              width={40}
              height={38}
              priority
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">
              UniSwap
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Campus Exchange
            </span>
          </div>
        </Link>

        {/* DESKTOP NAVIGATION */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            if (item.highlight) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="glass-button ml-2 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm active:scale-95"
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm"
                    : "text-slate-600 hover:bg-white/40 hover:text-slate-900"
                }`}
              >
                <Icon size={17} className={isActive ? "text-white" : "text-slate-400"} />
                <span>{item.name}</span>

                {/* UNREAD BADGE */}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white shadow-sm animate-pulse">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* AUTH CONTROLS */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-100" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                aria-label="Open your profile"
                title="Profile"
                className="rounded-xl ring-teal-200 transition hover:ring-2"
              >
                <ProfileAvatar profile={profile} user={user} />
              </Link>
              <span className="max-w-[160px] truncate text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                {profile?.full_name || user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="glass-control inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <LogIn size={15} />
                <span>Log in</span>
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <UserPlus size={15} />
                <span>Join</span>
              </Link>
            </div>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link
              href="/profile"
              aria-label="Open your profile"
              title="Profile"
              className="rounded-xl ring-teal-200 transition hover:ring-2"
            >
              <ProfileAvatar profile={profile} user={user} />
            </Link>
          )}

          {typeof unreadCount === "number" && unreadCount > 0 && (
            <Link
              href="/messages"
              aria-label={`Unread messages: ${unreadCount}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600"
            >
              <MessageSquare size={18} />
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="glass-control flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN MENU */}
      {mobileMenuOpen && (
        <div className="glass-surface md:hidden border-t border-slate-100 px-4 py-4 space-y-2 shadow-lg animate-in slide-in-from-top-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            if (item.highlight) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="glass-button flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm"
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm"
                    : "text-slate-700 hover:bg-white/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? "text-white" : "text-slate-400"} />
                  <span>{item.name}</span>
                </div>

                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-100">
            {user ? (
              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-w-0 items-center gap-2 rounded-xl pr-3 text-xs text-slate-500 hover:text-slate-900"
                >
                  <ProfileAvatar profile={profile} user={user} />
                  <span className="truncate">{profile?.full_name || user.email}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogIn size={16} />
                  <span>Log in</span>
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <UserPlus size={16} />
                  <span>Join</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
