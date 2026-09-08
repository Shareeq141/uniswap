import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { env } from "@/lib/env";
import "./globals.css";

const siteUrl = env.NEXT_PUBLIC_SITE_URL || "https://uniswap-campus.vercel.app";

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "UniSwap | Free Student Campus Marketplace",
    template: "%s | UniSwap",
  },
  description:
    "Give away or swap useful college items (calculators, textbooks, lab coats, drafting tools) with fellow students completely free on campus.",
  keywords: [
    "student marketplace",
    "campus swap",
    "college exchange",
    "free textbooks",
    "engineering drawing tools",
    "scientific calculator",
    "campus recycling",
  ],
  authors: [{ name: "UniSwap Team" }],
  creator: "UniSwap",
  publisher: "UniSwap",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "UniSwap | Free Student Campus Marketplace",
    description:
      "Give away or swap college essentials with students on your campus — free, simple, and sustainable.",
    url: siteUrl,
    siteName: "UniSwap",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UniSwap | Free Student Campus Marketplace",
    description:
      "Give away or swap college essentials with students on your campus — free, simple, and sustainable.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-900 bg-white min-h-screen selection:bg-teal-100 selection:text-teal-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
