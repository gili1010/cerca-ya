import management from "@/components/management/management.module.css";
import Link from "next/link";
import type {ReactNode} from "react";
import type {ServiceListingPresentation} from "@/types/services";
import {servicePriceLabel,serviceStatusLabels} from "@/lib/services/frontend";
import {ProductImage} from "@/components/details/product-image";
import {placeholderImage} from "@/lib/public-catalog";
import { Wrench, BookOpen, Leaf, Hammer, Truck } from "lucide-react";
import searchStyles from "./service-search.module.css";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function ServiceCard({listing,urls,owned=false,children,detailHref,providerHref,headingLevel=2}:{listing:ServiceListingPresentation;urls:Record<string,string>;owned?:boolean;children?:ReactNode;detailHref?:string;providerHref?:string;headingLevel?:2|3}){
 const Heading = headingLevel === 3 ? "h3" : "h2";
 const href=owned?`/mis-servicios/${listing.id}`:detailHref??`/servicio/${listing.id}`,photo=listing.images[0];
 const Icon = /clases|educacion/.test(listing.category_slug) ? BookOpen : /jardin|pasto/.test(listing.category_slug) ? Leaf : /transporte|flete/.test(listing.category_slug) ? Truck : /construccion|albanileria|carpinteria/.test(listing.category_slug) ? Hammer : Wrench;
 return <article className={`${styles.listingCard} ${searchStyles.card}`}>{(photo||!owned)&&<Link className={`${styles.cardPhoto} ${owned ? management.thumbnail : ""}`} href={href}>{photo?<ProductImage src={urls[photo.object_path]??placeholderImage} alt={listing.title}/>:<div className={searchStyles.placeholder} aria-label={`Servicio de ${listing.category_name}`}><Icon size={40} aria-hidden="true"/><span>{listing.category_name}</span></div>}</Link>}<div className={styles.cardBody}><span className={styles.badge}>{owned?serviceStatusLabels[listing.status]:"Servicio"} · {listing.category_name}</span><Heading><Link href={href}>{listing.title}</Link></Heading><strong className={styles.price}>{servicePriceLabel(listing.pricing_mode,listing.price)}</strong><p className={styles.metadata}>Acepta consultas: {listing.accepting_inquiries?"Sí":"No"}</p>{!owned&&<><Link className="secondary-link" href={providerHref??`/prestador/${listing.provider_id}`}>{listing.provider.display_name}</Link><p className={styles.metadata}>Trabaja en {listing.provider.areas.slice(0,2).map(area=>area.city).join(" · ")}{listing.provider.areas.length>2?` y ${listing.provider.areas.length-2} localidades más`:""}</p></>}{!owned&&headingLevel===3&&<Link className="secondary-link" href={href}>Ver servicio ›</Link>}{children}</div></article>;
}



