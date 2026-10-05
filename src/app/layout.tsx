import type { Metadata } from "next";
import { DemoProvider } from "@/components/demo-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BusinessProvider } from "@/components/businesses/business-provider";
import { UserLocationProvider } from "@/components/location/user-location-provider";
import { CartProvider } from "@/components/cart/cart-provider";
import "./globals.css";
import "./workflows.css";

export const metadata: Metadata = {
  title: "CercaYa — Encontralo cerca. Tenelo hoy.",
  description: "Encontrá productos cerca tuyo, con stock confirmado y disponibilidad para hoy. Descubrí comercios de tu barrio en CercaYa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR" data-scroll-behavior="smooth"><body><AuthProvider><BusinessProvider><UserLocationProvider><CartProvider><DemoProvider>{children}</DemoProvider></CartProvider></UserLocationProvider></BusinessProvider></AuthProvider></body></html>;
}
