"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import styles from "./pwa.module.css";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface PwaContextValue { available: boolean; ios: boolean; busy: boolean; install: () => Promise<void> }
const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const navigatorIos = navigator as Navigator & { standalone?: boolean };
    function mode() { setStandalone(media.matches || navigatorIos.standalone === true); }
    function connection() { setOffline(!navigator.onLine); }
    function installPrompt(event: Event) { event.preventDefault(); setPrompt(event as InstallEvent); }
    function installed() { setStandalone(true); setPrompt(null); }
    mode(); connection();
    const agent = navigator.userAgent;
    const apple = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(apple && /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent));
    media.addEventListener("change", mode);
    window.addEventListener("beforeinstallprompt", installPrompt);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    let live = true;
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(result => {
        if (live) { registration = result; void result.update().catch(() => {}); }
      }).catch(() => {});
    }
    function update() { if (navigator.onLine && registration) void registration.update().catch(() => {}); }
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => {
      live = false;
      media.removeEventListener("change", mode);
      window.removeEventListener("beforeinstallprompt", installPrompt);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
  }, []);
  async function install() {
    if (!prompt || pending.current) return;
    pending.current = true; setBusy(true);
    try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setStandalone(true); }
    catch { /* The browser can withdraw an install prompt; do not emulate it. */ }
    finally { setPrompt(null); pending.current = false; setBusy(false); }
  }
  return <PwaContext.Provider value={{ available: !standalone && Boolean(prompt), ios: !standalone && ios, busy, install }}>
    {children}
    {offline && <div className={styles.offline} role="alert"><section className={styles.offlinePanel}><WifiOff size={32} aria-hidden="true" /><h1>Sin conexión</h1><p>Necesitás conexión a internet para ver disponibilidad actualizada.</p><button type="button" className="primary-button" onClick={() => window.location.reload()}>Volver a intentar</button></section></div>}
  </PwaContext.Provider>;
}
export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa requires PwaProvider");
  return context;
}
