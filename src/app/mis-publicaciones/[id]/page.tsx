import { notFound } from "next/navigation";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { PublicationAuthGate } from "@/components/personal-listings/publication-auth-gate";
import { OwnedArticle } from "@/components/personal-listings/owned-article";
import { isPersonalListingId } from "@/lib/personal-listings/contracts";

export const metadata = { title: "Mi artículo | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!isPersonalListingId(id)) notFound();
  return <PersonalShell><PublicationAuthGate returnTo={`/mis-publicaciones/${id}`}><OwnedArticle key={id} id={id} /></PublicationAuthGate></PersonalShell>;
}
