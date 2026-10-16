"use client";

import type { OwnedPersonalListing, PersonalListingAction } from "@/types/personal-listings";
import { Dialog } from "@/components/home/dialog";
import { FormError } from "@/components/requests/request-common";
import styles from "./personal-listings.module.css";

export function ListingActionConfirmation({ listing, action, busy, error, onClose, onConfirm }: {
  listing: OwnedPersonalListing; action: PersonalListingAction; busy: boolean; error: string;
  onClose: () => void; onConfirm: () => void;
}) {
  const title = action === "sold" ? "¿Ya vendiste este artículo?" : action === "withdraw" ? "¿Retirar esta publicación?" : action === "pause" ? "¿Pausar esta publicación?" : "¿Reactivar esta publicación?";
  const description = action === "sold" ? "Se marcará como vendido y dejará de estar disponible. No podrás reactivar esta publicación."
    : action === "withdraw" ? "Dejará de estar disponible y no podrás reactivarla. Podrás seguir consultándola en Mis publicaciones."
    : action === "pause" ? "Dejará de estar disponible públicamente. Podés reactivarla cuando quieras."
    : "Volverá a estar disponible públicamente con las fotos y el contacto autorizado guardados.";
  return <Dialog title={title} onClose={() => { if (!busy) onClose(); }} preventCancel><div className={styles.modal}><h2>{title}</h2><p><strong>{listing.title}</strong></p><p>{description}</p><FormError message={error} />
    <div className={styles.actions}><button className="outline-button" disabled={busy} onClick={onClose}>Cancelar</button><button className={action === "withdraw" ? "danger-button" : "primary-button"} disabled={busy} onClick={onConfirm}>{busy ? "Guardando…" : action === "sold" ? "Marcar como vendido" : action === "withdraw" ? "Retirar publicación" : action === "pause" ? "Pausar" : "Reactivar"}</button></div></div></Dialog>;
}
