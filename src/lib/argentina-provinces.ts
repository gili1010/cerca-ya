export const argentinaProvinces = [{"code": "AR-B", "name": "Buenos Aires"}, {"code": "AR-C", "name": "Ciudad Autónoma de Buenos Aires"}, {"code": "AR-K", "name": "Catamarca"}, {"code": "AR-H", "name": "Chaco"}, {"code": "AR-U", "name": "Chubut"}, {"code": "AR-X", "name": "Córdoba"}, {"code": "AR-W", "name": "Corrientes"}, {"code": "AR-E", "name": "Entre Ríos"}, {"code": "AR-P", "name": "Formosa"}, {"code": "AR-Y", "name": "Jujuy"}, {"code": "AR-L", "name": "La Pampa"}, {"code": "AR-F", "name": "La Rioja"}, {"code": "AR-M", "name": "Mendoza"}, {"code": "AR-N", "name": "Misiones"}, {"code": "AR-Q", "name": "Neuquén"}, {"code": "AR-R", "name": "Río Negro"}, {"code": "AR-A", "name": "Salta"}, {"code": "AR-J", "name": "San Juan"}, {"code": "AR-D", "name": "San Luis"}, {"code": "AR-Z", "name": "Santa Cruz"}, {"code": "AR-S", "name": "Santa Fe"}, {"code": "AR-G", "name": "Santiago del Estero"}, {"code": "AR-T", "name": "Tucumán"}, {"code": "AR-V", "name": "Tierra del Fuego"}] as const;
export function normalizePlace(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}
export function provinceByCode(code: string | null | undefined) {
  return argentinaProvinces.find(province => province.code === code);
}
export function resolveProvince(state: unknown, code: unknown) {
  const name = typeof state === "string" ? normalizePlace(state).replace(/^provincia (de |del )?/, "") : "";
  const raw = typeof code === "string" ? code.toUpperCase() : "";
  return argentinaProvinces.find(p => p.code === raw || p.code === `AR-${raw}`)
    ?? argentinaProvinces.find(p => normalizePlace(p.name) === name)
    ?? (name === "ciudad de buenos aires" || name === "buenos aires ciudad" || name === "capital federal" || name === "caba" ? provinceByCode("AR-C")
    : name.startsWith("tierra del fuego") ? provinceByCode("AR-V") : undefined);
}
