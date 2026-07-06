import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/organizador/", "/conta/", "/auth/", "/portaria/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
