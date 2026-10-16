import { notFound } from "next/navigation";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { PublicArticle } from "@/components/personal-listings/public-article";
import { getPublicPersonalListing } from "@/lib/personal-listings/server";
import { isPersonalListingId } from "@/lib/personal-listings/contracts";
import type { PublicPersonalListing } from "@/types/personal-listings";
import { personalSearchReturnTo } from "@/lib/search-navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artículo particular | CercaYa" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { id } = await params; if (!isPersonalListingId(id)) notFound();
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = personalSearchReturnTo(typeof requestedReturn === "string" ? requestedReturn : null);
  let listing: PublicPersonalListing | null;
  try { listing = await getPublicPersonalListing(id); }
  catch {
    return <PersonalShell><section className="panel"><h1>No pudimos cargar el artículo.</h1><p>Volvé a intentar en unos momentos.</p><a className="primary-button" href={`/articulo/${id}?returnTo=${encodeURIComponent(returnTo)}`}>Reintentar</a></section></PersonalShell>;
  }
  if (!listing) notFound();
  return <PersonalShell><PublicArticle key={listing.id} initial={listing} returnTo={returnTo} /></PersonalShell>;
}
