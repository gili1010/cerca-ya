import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "Reglas para Comercios | CercaYa", description: "Compromisos básicos para publicar y gestionar un comercio en CercaYa." };
export default function MerchantRulesPage() {
  return <LegalPage title="Reglas para Comercios" intro="Queremos que las personas puedan confiar en los comercios de su barrio. Al crear tu comercio, declarás que su información es verdadera y aceptás estas reglas.">
    <section><h2>1. Información real y productos permitidos</h2><p>Publicá información real de tu comercio, sus productos, precios, contacto y opciones de entrega. Mantené los precios y la disponibilidad razonablemente actualizados. Publicá solamente productos permitidos y contenido que tengas derecho a utilizar; no publiques productos ilegales, información engañosa ni contenido ofensivo.</p></section>
    <section><h2>2. Cumplir los pedidos</h2><p>Confirmá pedidos que puedas cumplir, preparalos y coordiná su entrega o retiro. Avisá al comprador si surge un problema y respetá lo acordado. Sos responsable de la calidad, facturación, garantía y demás obligaciones de tu comercio. Tratá al comprador con respeto.</p><p>El pago se coordina directamente con el comprador. CercaYa no procesa ni recibe el dinero y no cobra comisión durante esta etapa inicial.</p></section>
    <section><h2>3. Cuidar los datos del comprador</h2><p>Usá el nombre, teléfono, dirección y referencias del comprador únicamente para preparar, coordinar y gestionar su pedido. No publiques esos datos, no los compartas con personas ajenas al pedido ni los utilices para spam o mensajes promocionales.</p></section>
    <section><h2>4. Incumplimientos y soporte</h2><p>CercaYa puede bloquear productos o suspender comercios ante incumplimientos y revisar los reportes recibidos. Las acciones de moderación no eliminan tus obligaciones sobre pedidos ya confirmados.</p><p>Para consultas o ayuda escribí a <a href="mailto:soporte@cercaya.com.ar">soporte@cercaya.com.ar</a>.</p></section>
  </LegalPage>;
}
