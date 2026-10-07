import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { DemoProvider } from "@/components/demo-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BusinessProvider } from "@/components/businesses/business-provider";
import { UserLocationProvider } from "@/components/location/user-location-provider";
import { CartProvider } from "@/components/cart/cart-provider";
import "./globals.css";
import "./workflows.css";
import "./pwa.css";

export const metadata: Metadata = {
  applicationName: "CercaYa",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, title: "CercaYa", statusBarStyle: "default" },
  title: "CercaYa — Encontralo cerca. Tenelo hoy.",
  description: "Encontrá productos cerca tuyo, con stock confirmado y disponibilidad para hoy. Descubrí comercios de tu barrio en CercaYa.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#196747" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR" data-scroll-behavior="smooth"><body><PwaProvider><AuthProvider><BusinessProvider><UserLocationProvider><CartProvider><DemoProvider>{children}</DemoProvider></CartProvider></UserLocationProvider></BusinessProvider></AuthProvider></PwaProvider></body></html>;
}
