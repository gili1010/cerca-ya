"use client";
import Link from "next/link";
export function LegalCheckbox({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="checkbox-label"><input type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} /><span>Declaro que tengo 18 años o más y acepto los <Link href="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones</Link>. He leído la <Link href="/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</Link>.</span></label>;
}
