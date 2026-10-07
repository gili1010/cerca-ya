import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "CercaYa", short_name: "CercaYa",
    description: "Encontralo cerca. Tenelo hoy.",
    start_url: "/", scope: "/", display: "standalone", orientation: "any",
    theme_color: "#196747", background_color: "#f6f8f5", lang: "es-AR",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
