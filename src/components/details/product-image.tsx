"use client";

import { useState, type ReactEventHandler } from "react";
import { placeholderImage } from "@/lib/public-catalog";

// Browser image loading supports manual URLs without opening Next's image proxy to arbitrary hosts.
export function ProductImage({ src, alt, className, onLoad }: { src: string; alt: string; className?: string; onLoad?: ReactEventHandler<HTMLImageElement> }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={failedSrc === src ? placeholderImage : src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onLoad={onLoad} onError={() => setFailedSrc(src)} />;
}
