import Marketplace from "@/components/marketplace";
import { Suspense } from "react";
export default function Home() { return <Suspense fallback={<main className="shell"><p role="status">Cargando CercaYa…</p></main>}><Marketplace /></Suspense>; }
