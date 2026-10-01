"use client";

import { useState } from "react";
import { placeholderImage } from "@/lib/public-catalog";

// Browser image loading supports manual URLs without opening Next's image proxy to arbitrary hosts.
export function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={failedSrc === src ? placeholderImage : src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
