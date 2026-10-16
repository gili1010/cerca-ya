import { notFound } from "next/navigation";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { PublicationAuthGate } from "@/components/personal-listings/publication-auth-gate";
import { ArticleEditor } from "@/components/personal-listings/article-editor";
import { isPersonalListingId } from "@/lib/personal-listings/contracts";

export const metadata = { title: "Editar mi artículo | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!isPersonalListingId(id)) notFound();
  return <PersonalShell><PublicationAuthGate returnTo={`/mis-publicaciones/${id}/editar`}><ArticleEditor key={id} listingId={id} /></PublicationAuthGate></PersonalShell>;
}
