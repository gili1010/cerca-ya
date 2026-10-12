# Descubrimiento por distancia y localidad

## Activación

Aplicar manualmente `supabase/hyperlocal-locality-fallback.sql` después de las etapas vigentes de ubicación/catálogo y Analytics. No repetir SQL históricos ni modificar comercios o productos. Desplegar el código asociado: ambas RPC ahora aceptan `p_group`, con valor distance o locality. Se eliminan las firmas anteriores exactas para evitar sobrecargas ambiguas.

El delta no asigna coordenadas, no cambia la información de Pura Limpieza y no modifica RLS, Radar, pedidos abiertos ni ofertas. Cada grupo usa las mismas consultas existentes con un alcance explícito, no otro catálogo.

## Reglas

- **distance:** comprador y comercio con puntos válidos, Haversine y radio 5/10/20/50. Resultado geográfico independiente de la localidad textual del comercio.
- **locality con GPS comprador:** sólo comerciantes con ambas coordenadas NULL, city normalizada coincidente, province_code coincidente, province correspondiente al código y country_code AR. Un comercio con punto fuera del radio nunca pasa a este grupo.
- **locality sin GPS comprador:** misma identidad canónica; admite comercios con punto válido o con ambos campos NULL, pero no calcula ni muestra kilómetros porque falta el punto del comprador.
- Coordenadas parciales o inválidas no se reinterpretan como ausencia de punto. Sin ubicación o sin datos canónicos para locality no hay consultas nacionales.
- Activo/público, comercio sin admin_suspended_at y producto sin admin_blocked_at se exigen en PostgreSQL para ambos grupos.
- Búsqueda, categoría, Hoy (STOCKED/ON_DEMAND), retiro y confirmación son los mismos para ambos conjuntos. Con envío comprobado excluye locality; fuera de ese filtro se aclara que el comercio realiza envíos y hay que consultar cobertura.

## Conteos y páginas

Dos consultas acotadas, conteos y páginas independientes: 12 productos por grupo en Home, 24 en búsqueda; tiendas hasta 8 por grupo. PostgreSQL filtra y cuenta antes de paginar; sólo se hidratan los IDs de esas páginas.

URL conserva page para distancia y locality_page para localidad. Cambiar búsqueda/categoría/filtros/orden/ubicación reinicia ambos; cambiar radio reinicia únicamente distancia y no invalida la consulta/cache de localidad. Páginas antiguas que quedan fuera del nuevo total vuelven a la última página válida. No se concatenan ni filtran listas nacionales en el navegador.

## Analytics compatible

Un evento por intención explícita de Buscar/Enter, después de obtener ambos conteos completos. Si falla un conjunto, no se registra un cero parcial como ausencia de oferta. No se generan eventos por paginación, refresh, radio ni reajustes automáticos.

- results_count = total geográfico + total por localidad.
- distance_results_count = total con distancia calculable dentro del radio.
- locality_results_count = total descubierto por identidad de localidad/provincia, sin distancia calculada.

Ejemplo: 0 geográficos y 4 locales se guarda como results_count=4, distance_results_count=0, locality_results_count=4. El dashboard actual sigue usando total/has_results: ya no clasifica esa búsqueda como completamente sin oferta, pero los 4 no son kilómetros verificados. No se rediseña Admin ni se infieren conteos históricos: las nuevas columnas quedan NULL en eventos anteriores y clientes antiguos que omiten ambos argumentos.

## QA manual A–N (preparados, no ejecutados)

| Caso | Preparación y resultado esperado |
|---|---|
| A | Comprador GPS Anisacate/AR-X y Pura Limpieza sin ambos puntos: productos en También en Anisacate. |
| B | Comercio GPS a 3 km, radio20: grupo Cerca tuyo. |
| C | Comercio GPS a 30 km con misma city, radio5: fuera de ambos grupos. |
| D | Comercio sin puntos en otra localidad (Tierra del Fuego): fuera. |
| E | Misma city y provincia/código diferente: fuera. |
| F | Radio5 y Pura Limpieza: sólo localidad; sin 0km ni promesa dentro de5. |
| G | Buscar jabón/jabon: Pura Limpieza sólo si coincide texto normalizado. |
| H | Categoría Limpieza: ambos grupos aplican su slug. |
| I | Hoy: respetar stock real o disponibilidad ON_DEMAND, sin implicar envío inmediato. |
| J | Con envío: sólo geográficos dentro de delivery_radius_km; localidad excluida. |
| K | Buscar tienda sin GPS de la misma localidad: grupo tiendas de localidad, sin km. |
| L | Pedido Abierto20 y comercio sin punto: Radar y ofertas siguen sin admitir coincidencia textual. |
| M | Muchos productos: paginar cada grupo independientemente, comparar totales y ausencia de duplicados; variar radio conservando página local. |
| N | Comprador sin GPS con identidad canónica: sólo exploración por localidad, sin afirmación de radio. |

También probar: ninguna ubicación → solicitud de ubicación; GPS sin localidad/provincia confiable → sólo distancias y posibilidad de actualizar ubicación; bloqueos/suspensiones excluyen los productos; proveedor/catálogo con error no registra ausencia falsa de oferta.

Para Pura Limpieza: con ubicación del comprador en Anisacate/AR-X, limpiar filtros (o elegir Hoy sólo si los productos cumplen disponibilidad), buscar jabón y revisar el grupo local. No hace falta editar comercio/productos ni recuperar un GPS inexistente.

No se ejecutaron navegador, tests, TypeScript, build, lint, E2E ni SQL remoto. Los casos requieren validación manual contra los datos reales después del delta.
