import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { PublicationAuthGate } from "@/components/personal-listings/publication-auth-gate";
import { MyListings } from "@/components/personal-listings/my-listings";

export const metadata = { title: "Mis publicaciones | CercaYa" };
export default function Page() {
  return <PersonalShell><PublicationAuthGate returnTo="/mis-publicaciones"><MyListings /></PublicationAuthGate></PersonalShell>;
}
