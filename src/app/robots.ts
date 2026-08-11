import type { MetadataRoute } from "next";

/** RPT2.1 — private family tutor: block all crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
