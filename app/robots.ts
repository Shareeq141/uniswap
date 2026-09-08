import { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || "https://uniswap-campus.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/marketplace", "/marketplace/*"],
      disallow: ["/messages", "/messages/*", "/requests", "/give"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
