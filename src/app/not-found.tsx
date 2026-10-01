import Link from "next/link";
export default function NotFound() { return <main className="shell workflow"><section className="empty-state"><h1>No encontramos esta página</h1><p>Volvé a explorar productos o revisá tus pedidos.</p><Link className="primary-button" href="/">Ir al inicio</Link><Link className="secondary-link" href="/pedidos">Mis pedidos</Link></section></main>; }
