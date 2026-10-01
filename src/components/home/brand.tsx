import { MapPin } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/" aria-label="CercaYa, inicio">
    <span className="brand-icon"><MapPin size={23} strokeWidth={2.7} /></span>
    Cerca<span className="brand-ya">Ya</span><span className="brand-period">.</span>
  </Link>;
}
