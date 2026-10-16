"use client";

import Link from "next/link";
import type { OwnedPersonalListing, PersonalListingAction } from "@/types/personal-listings";
import styles from "./personal-listings.module.css";

export const personalStatusLabels = { DRAFT: "Borrador", PUBLISHED: "Publicada", PAUSED: "Pausada", SOLD: "Vendida", WITHDRAWN: "Retirada" } as const;
export function ListingStatus({ listing }: { listing: OwnedPersonalListing }) {
  return <><span className={styles.badge} data-status={listing.status}>{personalStatusLabels[listing.status]}</span>
    {listing.expired && <span className={styles.metadata}>Vencimiento alcanzado · No disponible públicamente</span>}
    {listing.admin_blocked && <p className="form-error">Bloqueada por administración{listing.admin_block_reason ? `: ${listing.admin_block_reason}` : "."}</p>}</>;
}
export function ListingActions({ listing, disabled, suspended = false, onAction }: {
  listing: OwnedPersonalListing; disabled: boolean; suspended?: boolean;
  onAction: (listing: OwnedPersonalListing, action: PersonalListingAction) => void;
}) {
  const editable = !listing.admin_blocked && !suspended && listing.status !== "SOLD" && listing.status !== "WITHDRAWN";
  const publicView = listing.status === "PUBLISHED" && !listing.admin_blocked && !listing.expired && !suspended;
  const canPublish = listing.images.length > 0 && listing.contact_method === "WHATSAPP" && !listing.expired;
  return <div className={styles.cardActions}><Link className="outline-button" href={publicView ? `/articulo/${listing.id}` : `/mis-publicaciones/${listing.id}`}>Ver</Link>
    {editable && <><Link className="outline-button" href={`/mis-publicaciones/${listing.id}/editar`}>Editar</Link>
      {listing.status === "PUBLISHED" && <button className="outline-button" disabled={disabled} onClick={() => onAction(listing, "pause")}>Pausar</button>}
      {listing.status === "PAUSED" && (canPublish ? <button className="primary-button" disabled={disabled} onClick={() => onAction(listing, "publish")}>Reactivar</button> : <Link className="primary-button" href={`/mis-publicaciones/${listing.id}/editar`}>Revisar y publicar</Link>)}
      {(listing.status === "PUBLISHED" || listing.status === "PAUSED") && <button className="outline-button" disabled={disabled} onClick={() => onAction(listing, "sold")}>Marcar vendido</button>}
      <button className="ghost-button" disabled={disabled} onClick={() => onAction(listing, "withdraw")}>Retirar</button></>}
  </div>;
}
