# QA hiperlocal — preparación para prueba manual

Implementación revisada por inspección. **A–N no ejecutados contra Supabase ni navegador.** Aplicar primero `supabase/hyperlocal-marketplace.sql` junto con el despliegue de estos loaders. No repetir migraciones históricas.

Usar exclusivamente cuentas/comercios/productos [QA]. Las distancias son Haversine (línea recta); preparar puntos con margen respecto del límite, no distancias por carretera. Comercios y productos deben estar activos y cumplir los demás filtros. No modificar datos reales para construir estos escenarios.

| Caso | Preparación | Resultado esperado y garantía |
| --- | --- | --- |
| A | Producto a 2 km, radio 20 | Aparece: `filtered.distance_km <= v_radius`. |
| B | Producto a 25 km, radio 20 | Excluido del listado, conteo y ranking. |
| C | Mismo producto, seleccionar 50 | Aparece; página vuelve a 0. |
| D | Producto a 500 km, radio 50 | Excluido, sin expansión automática. |
| E | Coincidencia exacta sólo a 500 km, radio 20 | Cero productos locales; ampliar/CTA Pedido Abierto. Analytics registra 0 al pulsar Buscar. |
| F | Comercio a 8 km, envío habilitado en ambos, cobertura 10 | Cumple Con envío. |
| G | Comercio a 12 km, cobertura 10 | Excluido de Con envío, aunque esté dentro del radio del catálogo. |
| H | Tienda a 7 km, radio 10, texto coincidente | Aparece; `search_public_stores` filtra antes del límite 8. |
| I | Tienda a 30 km, radio 20 | Excluida. |
| J | Olvidar ubicación, sin localidad | Prompt de ubicación, sin consultas nacionales; navegación directa pública sigue disponible. |
| K | Pedido 20 km, comercio a 8 km | Visible en `read_radar`, oferta permitida si cumple las demás reglas. |
| L | Pedido 20 km, comercio a 25 km | No visible ni por UUID; `create_my_offer` rechaza. Trigger también bloquea INSERT directo. |
| M | Publicar sin coordenadas | Mensaje claro en formulario; RPC e INSERT directo rechazados en PostgreSQL. |
| N | Buscar repuesto moto sin productos y abrir CTA | Título editable `Busco repuesto moto`; radio inicial 20, independientemente del 50 del catálogo. |

Además verificar:

- 5/10/20/50 en productos y tiendas, categorías, Home/Hoy; refresh conserva radio/filtros/página sin nuevo evento analytics.
- Sólo Enter/Buscar mide; cambiar radio, paginar, tipear o actualizar ubicación no mide. El contexto incluye radio/localidad para descartar mediciones de respuestas anteriores.
- Búsqueda sin tildes y mayúsculas conserva normalización existente.
- Comercio sin coordenadas válidas nunca entra en un radio; Con envío sin coordenadas no puede activarse.
- Si hay localidad realmente conocida pero no coordenadas, sólo coincidencia exacta normalizada de ciudad, sin prometer km ni cobertura de envío. El proveedor actual normalmente conserva localidad junto con coordenadas; no se inventa localidad ni se usa IP.
- Coordenadas del comprador no aparecen en Radar/ofertas, URL ni Analytics; Realtime conserva aviso mínimo y reconsulta.
- Pedido 10 km: comercio a 8 km visible; a 12 km invisible/oferta rechazada.
- Pedidos históricos sin ubicación no se migran: mantienen la compatibilidad anterior. La obligación de ubicación/radios 5/10/20 aplica a INSERT nuevos.

No se ejecutaron SQL remoto, navegador, build, lint completo ni E2E. Las pruebas unitarias aisladas de loaders/URL usan dobles locales, no prueban PostgreSQL ni reemplazan esta validación manual.
