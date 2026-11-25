import type { MetadataRoute } from "next";
import { manifestData } from "@/lib/pwa/manifest-data";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: manifestData.name,
    short_name: manifestData.shortName,
    description: manifestData.description,
    start_url: manifestData.startUrl,
    scope: manifestData.scope,
    display: manifestData.display,
    background_color: manifestData.backgroundColor,
    theme_color: manifestData.themeColor,
    lang: manifestData.lang,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
