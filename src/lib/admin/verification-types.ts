export const verificationRemovalReasons = ["Datos inconsistentes", "Comercio cerrado", "Cambio de responsable", "Reportes o incumplimientos", "Verificación realizada por error", "Otro"] as const;
export interface BusinessVerification { verified: boolean; verified_at: string | null; verified_by: string | null; admin_name: string | null }
