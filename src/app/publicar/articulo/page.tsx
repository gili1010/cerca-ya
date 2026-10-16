import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { PublicationAuthGate } from "@/components/personal-listings/publication-auth-gate";
import { ArticleEditor } from "@/components/personal-listings/article-editor";

export const metadata = { title: "Vender un artículo | CercaYa" };
export default function Page() {
  return <PersonalShell><PublicationAuthGate returnTo="/publicar/articulo"><ArticleEditor key="new-article" /></PublicationAuthGate></PersonalShell>;
}
