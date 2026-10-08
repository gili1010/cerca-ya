# Verificación mínima de comercios

## Modelo reutilizado

Ya existe `businesses.verified boolean not null default false`. Es la única fuente
de estado: false = UNVERIFIED, true = VERIFIED. No se agrega verification_status
ni un segundo boolean. No se cambia ningún comercio al instalar el delta.

Se reutiliza también `private.admin_audit_logs`. Al verificar, el evento tiene
`admin_user_id = auth.uid()` y `created_at = clock_timestamp()`. La lectura Admin
proyecta esos campos del último BUSINESS_VERIFIED como `verified_by` y `verified_at`.
**No son columnas nuevas de businesses**: quedan en la auditoría privada para no
exponer la identidad del administrador mediante las lecturas públicas de comercios.

Al retirar verificación, businesses.verified queda false y la proyección de
verified_at/verified_by devuelve NULL. Los eventos anteriores no se borran.
Se conserva una verificación true previa; si no tenía auditoría, no se inventa
una fecha ni un administrador y la UI informa que no están registrados.

## SQL y seguridad

Ejecutar manualmente `supabase/business-verification.sql` después de Admin Fase 2.
No se ejecutó SQL remoto ni se modificaron migraciones históricas.

Funciones:

- `public.admin_set_business_verification(uuid,boolean,text,text)`.
- `public.admin_read_business_verification(uuid)`.
- `private.guard_business_verification()` como trigger.

Ambas RPC requieren `private.require_admin()` dentro de PostgreSQL. El setter
valida el boolean, UUID, motivo (obligatorio al retirar) y nota de hasta 500
caracteres. Bloquea la fila, verifica existencia y evita repetir el mismo cambio.
Estado y auditoría se escriben en una única transacción. No acepta fechas ni IDs
de administrador desde el cliente.

Los propietarios/usuarios normales no pueden ejecutar cambios válidos: el control
Admin es obligatorio. Se revocan permisos directos sobre verified y un trigger
exige el contexto privado de la RPC y su rol propietario además de is_admin.
El trigger protege incluso si en el futuro se amplían grants o RPCs de edición.
No modifica la lógica de suspensión ni la visibilidad pública existente.

Se agregan acciones BUSINESS_VERIFIED y BUSINESS_UNVERIFIED a la constraint de
auditoría, conservando las acciones de Admin Fases 1 y 2. Motivo y nota se muestran
en `/admin/auditoria`; no se agregan datos privados al frontend público.

## Interfaz

- `/admin/comercios/[id]`: sección Verificación, estado, fecha/administrador cuando
  hay registro, confirmación al verificar y motivo obligatorio al retirar.
- Motivos: Datos inconsistentes, Comercio cerrado, Cambio de responsable,
  Reportes o incumplimientos, Verificación realizada por error y Otro.
- `/tienda/[slug]`: badge junto al nombre cuando verified es true.
- Cards de tiendas en resultados: indicador compacto independiente del enlace;
  tocar el indicador abre su explicación sin navegar a la tienda.
- Hover muestra título; click/teclado abre el diálogo existente, también en móvil.
- Explicación: «Comercio verificado por CercaYa» y
  «CercaYa confirmó la existencia de este comercio y su responsable.»
- `/comercio`: «Comercio verificado / CercaYa verificó tu comercio.» o
  «Comercio no verificado / Más adelante vas a poder solicitar la verificación
  de tu comercio.» No hay botón de solicitud, precio ni pago.

La verificación no promete calidad, garantía, entrega o seguridad de compra.
No altera stock, productos, ranking, analytics ni los siete pasos del onboarding.
No se añadió indicador opcional a las cards de producto en esta fase.

Las consultas públicas siguen filtrando active=true. Un comercio suspendido
conserva opcionalmente su estado interno, pero no aparece como tienda operativa
ni como card pública. Al reactivarlo, el badge puede volver a aparecer.

## Prueba manual

1. Aplicar business-verification.sql en el proyecto correspondiente antes de usar
   la sección nueva de Admin y desplegar/iniciar estos cambios.
2. Abrir `/admin/comercios/[id]` con una cuenta Admin y un comercio no verificado.
   Verificar el estado y abrir Verificar comercio. Cancelar: no debe cambiar nada.
3. Confirmar verificación con una nota corta. Revisar estado, fecha y administrador.
   En `/admin/auditoria`, comprobar BUSINESS_VERIFIED, comercio, nota y fecha.
4. Abrir la tienda pública activa y buscar el comercio por nombre: debe aparecer
   el badge. Probar hover, click, Tab/Enter, cerrar con botón y Escape, y móvil.
5. En `/comercio`, verificar el texto del comerciante y que onboarding siga teniendo
   siete pasos; no debe aparecer solicitud, compra ni pago de verificación.
6. Quitar verificación: intentar confirmar sin motivo (debe impedirlo), después
   seleccionar motivo y nota. Comprobar que el comercio no se borra ni suspende,
   desaparece el badge y la lectura Admin devuelve verified_at/verified_by NULL.
7. Revisar BUSINESS_UNVERIFIED con motivo/nota. La acción BUSINESS_VERIFIED anterior
   debe conservarse. Volver a verificar: debe mostrar la fecha/admin nuevos.
8. Con usuario normal/propietario, intentar la RPC setter y update directo de
   verified: debe estar denegado. La RPC de lectura privada también debe fallar.
9. Repetir manualmente una RPC con el mismo estado: no debe agregar otra auditoría.
10. Suspender un comercio verificado con la acción Admin existente: su tienda debe
    quedar no disponible y no aparecer en búsquedas. La verificación interna
    puede seguir true. Reactivar y volver a consultar: el badge debe reaparecer.
11. Si existía un comercio verified=true previo al delta sin evento histórico,
    comprobar que mantiene su estado y muestra datos de verificación no registrados.

No se ejecutaron tests, navegador, build, E2E, SQL remoto ni ciclos de validación.

## Archivos creados/modificados

- `supabase/business-verification.sql`
- `src/lib/admin/verification-types.ts`
- `src/lib/admin/verification-actions.ts`
- `src/components/admin/business-verification.tsx`
- `src/components/businesses/verification-badge.tsx`
- `src/components/businesses/verification-status.tsx`
- `src/components/businesses/verification.module.css`
- `src/types/database.ts`
- `src/lib/admin/types.ts`
- `src/app/admin/auditoria/page.tsx`
- `src/app/admin/comercios/[id]/page.tsx`
- `src/lib/public-store-server.ts`
- `src/components/stores/store-header.tsx`
- `src/lib/public-store-search.ts`
- `src/components/home/store-card.tsx`
- `src/components/home/store-search.module.css`
- `src/components/radar/merchant-workspace.tsx`
- `BUSINESS_VERIFICATION.md`
