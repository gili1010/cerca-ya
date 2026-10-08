# Analítica interna de demanda

## Fuente y compatibilidad

Ya existía `public.search_events` en schema.sql, con `query`, `results_count`,
fecha y columnas opcionales de usuario/coordenadas. No existía tracking activo.
El delta reutiliza esa tabla y el campo `results_count`; no crea otra tabla de
eventos ni elimina filas/columnas históricas. Las filas anteriores compatibles
participan de los agregados, por lo que las métricas pueden incluir historia previa.

SQL a ejecutar manualmente: `supabase/business-analytics.sql`, después de
schema.sql y admin-phase-1.sql. No modifica migraciones históricas. Requiere
que el buscador real con `read_marketplace_page` ya funcione.

## Momento de registro

Sólo Buscar/Enter del Hero arma una intención, con un UUID aleatorio por evento.
Se espera a que el catálogo termine correctamente en el mismo contexto de
búsqueda/filtros. Se usa el total exacto devuelto por el catálogo público, no el
número de cards de una página ni una búsqueda paralela.

No se registra cada tecla aunque el buscador existente consulte con debounce.
Tampoco se registran carga inicial, paginación, orden/filtros por sí solos,
focus, re-render, volver atrás, Realtime o refresh automático. El texto debe
tener entre 2 y 120 caracteres. Guardados y búsquedas vacías no cuentan.

Una intención se consume una vez. Se ignora un doble envío idéntico dentro de
dos segundos y PostgreSQL ignora un UUID repetido. Volver a buscar explícitamente
el mismo término después de ese intervalo sí cuenta como nueva intención.
Si cambia el contexto antes de llegar el resultado o falla el catálogo, se descarta
la medición. La falla de analytics es silenciosa y no cambia los resultados.

Esta etapa mide búsquedas explícitamente enviadas. Una persona que sólo escribe
y mira resultados sin usar Buscar/Enter no queda medida.

## Datos y privacidad

Cada evento nuevo tiene:

- id aleatorio por evento, no identificador persistente de persona/dispositivo;
- query legible y normalized_query generado por PostgreSQL;
- results_count existente y has_results generado como results_count > 0;
- category_id cuando existe filtro de categoría conocido;
- locality cuando Geoapify ya resolvió una localidad; si no, NULL;
- created_at definido por PostgreSQL.

Normalización: trim, minúsculas, espacios repetidos y equivalencia básica de
acentos. Admin conserva un texto representativo real para mostrar cada grupo.
No se hacen correcciones semánticas ni inferencia de rubros con IA.

El tracking no envía ni guarda user_id, latitud, longitud, dirección, teléfono,
email, nombre, IP ni fingerprint. Las columnas personales antiguas quedan NULL
en los nuevos eventos; los valores históricos se conservan pero no se entregan
por la RPC de Admin. Las coordenadas sólo siguen participando transitoriamente
en el buscador existente y en la comparación de su contexto, nunca en el payload
o en la tabla de analytics.

Se omiten términos que parezcan contener email, URL o una secuencia larga de
teléfono. Es una precaución básica: un texto libre no permite garantizar que
nunca se escriba un nombre o una dirección. Conviene considerar ese límite al
definir retención y revisar los textos de privacidad antes del lanzamiento.

No se añaden cookies, servicios externos ni scripts de terceros. La tabla es
histórica; no hay borrado automático. Una política de retención/borrado manual
podrá definirse después sin afectar el flujo de búsqueda.

## Seguridad y límites

- RLS sigue habilitada.
- Se revocan SELECT y escrituras directas de anon/authenticated, incluidos los
  permisos de columnas anteriores, y se retiran las dos policies del esquema base.
- `record_search_event` permite a anon/authenticated insertar sólo por RPC, con
  límites de query, contador y localidad, validación de categoría y deduplicación.
  No admite identidad, coordenadas, fechas ni edición de eventos.
- `admin_search_analytics` ejecuta `private.require_admin()` dentro de PostgreSQL.
  La protección no depende sólo del layout o frontend.
- Admin consulta agregados y páginas de hasta 20 términos; no recibe eventos crudos.

El contador enviado por la interfaz proviene del buscador público real, cuya
lectura excluye productos/comercios inactivos. Las guardas de Admin existentes
mantienen `active=false` cuando bloquean/suspenden. No se copió la búsqueda a analytics.

Una RPC anónima puede invocarse manualmente con datos inventados: esta primera
etapa valida límites y formato, pero no certifica métricas contra bots ni implementa
rate limit con IP/fingerprint. No usar estas cifras para facturación o auditoría financiera.

## Admin

Ruta `/admin/analitica`, incluida en la navegación:

- Períodos móviles de 7, 30 y 90 días; predeterminado 30.
- Localidades provenientes de eventos del período, sin ciudades hardcodeadas.
  Todas incluye también eventos sin localidad.
- Mínimo de 2 búsquedas para oportunidades; opciones 1 (todas), 2 o 3.
- Totales, con resultados, sin resultados y tasa sin resultados.
- Oportunidades con al menos un evento sin resultados, ordenadas por cantidad
  sin resultados, luego porcentaje y cantidad total.
- Lo más buscado ordenado por búsquedas totales.
- Paginación independiente en PostgreSQL para ambas tablas.
- Última búsqueda con horario de Argentina y scroll controlado de tablas en móvil.
- Estado vacío amigable y error amigable mediante el manejo actual de Admin.

Tasa = 100 × búsquedas sin resultados / búsquedas totales, redondeada a un decimal.
No significa porcentaje de productos faltantes ni ventas perdidas: los filtros
(por ejemplo Hoy o Menos de 5 km) también pueden llevar a cero resultados.

El dashboard `/admin` agrega sólo búsquedas totales y sin resultados en siete días,
con enlace al detalle. Si falla analytics, el resumen previo sigue funcionando.
No se agregaron detalle/modal opcional, IA, notificaciones ni Pedido Abierto automático.

## Funciones del delta

- `private.normalize_search_query(text)`.
- `public.record_search_event(uuid,text,integer,uuid,text)`.
- `public.admin_search_analytics(integer,text,integer,integer,integer)`.

## Prueba manual

1. Ejecutar el delta en el proyecto correspondiente y desplegar/iniciar los cambios.
2. En Home escribir letra por letra un término conocido sin enviar. Mediante el
   dashboard/SQL autorizado, comprobar que no creó eventos.
3. Pulsar Enter o Buscar, esperar resultados y verificar una fila cuyo results_count
   sea el total mostrado, con has_results correcto y user_id/latitude/longitude NULL.
4. Paginar, cambiar foco de ventana, refrescar y volver atrás: no deben crear eventos.
5. Repetir explícitamente con `Lomito`, ` lomito ` y `LOMITO`, dejando más de dos
   segundos entre envíos: deben agruparse por normalized_query en Admin.
6. Buscar un término sin oferta al menos dos veces: cada envío válido cuenta cero
   resultados; debe aparecer en oportunidades con 100% sin resultados.
7. Comprobar que un único envío no aparece con el mínimo predeterminado de dos;
   seleccionar Todas las búsquedas para verlo.
8. Seleccionar categoría, escribir un término y enviar: verificar category_id.
9. Con localidad resuelta, enviar y filtrar esa localidad en Admin. Sin ubicación,
   enviar y verificar locality NULL; debe contar en Todas.
10. Con una cuenta de prueba propietaria, buscar productos inactivos/bloqueados y
    de comercios inactivos/suspendidos: sólo debe contar lo visible del catálogo.
11. Probar `/admin/analitica` con 7/30/90 días, mínimo y localidad; comparar totales,
    tasas, orden y paginación cuando existan más de 20 términos.
12. Verificar las dos métricas de siete días del dashboard y layout móvil de tablas.
13. Con un usuario no Admin, intentar ejecutar `admin_search_analytics`: debe fallar.
    Con anon/authenticated, intentar SELECT o INSERT directo: debe estar denegado.
14. Simular manualmente el bloqueo de la RPC de tracking en herramientas del navegador:
    la búsqueda debe seguir mostrando resultados sin mensaje de error de analytics.
15. Probar doble clic rápido, query vacía, de un carácter, excesivamente larga y texto
    con email/teléfono: no deben inflar los eventos conforme a los filtros descritos.

No se ejecutaron tests, TypeScript, build, navegador, E2E, SQL remoto ni ciclos de validación.

## Archivos de esta etapa

- `supabase/business-analytics.sql`
- `src/lib/search-analytics.ts`
- `src/components/marketplace.tsx`
- `src/types/database.ts`
- `src/lib/admin/analytics.ts`
- `src/app/admin/analitica/page.tsx`
- `src/components/admin/analytics.module.css`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `BUSINESS_ANALYTICS.md`
