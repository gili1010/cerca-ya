export type NavigationSection = "home" | "search" | "publish" | "activity" | "account";

export function navigationSection(path: string, homeSection: NavigationSection = "home"): NavigationSection | null {
 if (path === "/") return homeSection;
 if (/^\/(cuenta|login|registro|recuperar-clave|restablecer-clave)(\/|$)/.test(path)) return "account";
 if (/^\/(publicar|necesito-un-servicio)(\/|$)/.test(path) || path === "/pedido/nuevo") return "publish";
 if (/^\/(producto|articulo|tienda|prestador|servicio)(\/|$)/.test(path)) return "search";
 if (/^\/(pedidos|pedido|reservas|reserva|comercio|mis-publicaciones|mis-servicios|mi-perfil-profesional|mis-solicitudes-servicio|solicitud-servicio|radar-servicios|mis-propuestas-servicio|guardados)(\/|$)/.test(path)) return "activity";
 return null;
}
