import { Info } from "lucide-react";

export function DemoNotice() {
  return <p className="detail-demo-notice"><Info size={15} /><span><strong>Estás explorando una demo.</strong> Stock, comercios, direcciones, distancias y horarios son ficticios. Confirmaciones del catálogo con referencia a las 15:00. Las reservas se guardan solo en este navegador; no se envían a comercios reales ni generan cobros.</span></p>;
}
