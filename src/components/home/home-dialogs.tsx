import Link from "next/link";
import { ArrowRight, MapPin, Search, ShieldCheck, Store, UserRound } from "lucide-react";
import { Dialog } from "./dialog";
import { BuyerLocationControls } from "../location/buyer-location-controls";

export type HomeModal = "zone" | "account" | "how" | null;
interface HomeDialogsProps { modal: HomeModal; onClose: () => void }

export function HomeDialogs({ modal, onClose }: HomeDialogsProps) {
  if (!modal) return null;
  const titles = { zone: "Tu ubicación", account: "Tu barrio, a tu manera", how: "Cerca, confirmado, hoy" };
  return <Dialog title={titles[modal]} onClose={onClose}><div className="dialog-body text-dialog">
    <span className="dialog-symbol">{modal === "zone" ? <MapPin /> : modal === "account" ? <UserRound /> : <ShieldCheck />}</span><h2>{titles[modal]}</h2>
    {modal === "zone" && <BuyerLocationControls />}
    {modal === "account" && <><p>Entrá a tu cuenta para ver tu perfil. Tus pedidos y reservas se guardan en tu cuenta.</p><div className="account-links"><Link href="/cuenta" onClick={onClose}>Mi cuenta <ArrowRight size={16} /></Link><Link href="/registro" onClick={onClose}>Crear cuenta <UserRound size={16} /></Link><Link href="/pedidos" onClick={onClose}>Mis pedidos <ArrowRight size={16} /></Link><Link href="/reservas" onClick={onClose}>Mis reservas <ArrowRight size={16} /></Link><Link href="/comercio/reservas" onClick={onClose}>Reservas del comercio <Store size={16} /></Link><Link href="/comercio" onClick={onClose}>Modo comercio <Store size={16} /></Link></div><button className="primary-button" onClick={onClose}>Seguir explorando</button></>}
    {modal === "how" && <><p>Encontralo cerca. Tenelo hoy.</p><div className="how-step"><Search /><div><h3>Buscá un producto</h3><p>Elegí una categoría o contanos qué necesitás. Podés contactar al comercio por WhatsApp desde el producto.</p></div></div><div className="how-step"><ShieldCheck /><div><h3>Si no está publicado, pedilo</h3><p>Publicá un Pedido Abierto. Los comercios pueden enviarte ofertas; actualizá el pedido para consultarlas.</p></div></div><div className="how-step"><Store /><div><h3>Publicá desde tu comercio</h3><p>Agregá tus productos y mantené el stock actualizado.</p></div></div><p className="info-note">Reservá un producto y seguí el estado de tu reserva desde tu cuenta. Coordiná el retiro o envío con el comercio.</p><Link className="primary-button" href="/pedido/nuevo" onClick={onClose}>Crear un pedido <ArrowRight size={16} /></Link></>}
  </div></Dialog>;
}



