export function authErrorMessage(error: unknown, action: "login" | "signup" | "logout"): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["user_already_exists", "email_exists"].includes(code)) return "El email ya está registrado.";
  if (code === "invalid_credentials") return "Email o contraseña incorrectos.";
  if (code === "email_not_confirmed") return "Revisá tu email y confirmá tu cuenta antes de iniciar sesión.";
  if (code === "weak_password") return "La contraseña no cumple los requisitos de seguridad. Usá una más larga y combiná letras, números y símbolos.";
  if (["over_email_send_rate_limit", "over_request_rate_limit", "too_many_requests"].includes(code)) return "Se hicieron demasiados intentos. Esperá unos minutos y volvé a intentar.";
  if (code === "email_address_not_authorized") return "No pudimos enviar la confirmación a ese email. El envío de correos todavía tiene restricciones.";
  if (code === "email_address_invalid") return "Ingresá un email válido.";
  if (code === "signup_disabled") return "El registro no está disponible en este momento.";
  return action === "signup" ? "No pudimos crear tu cuenta. Intentá nuevamente." : action === "logout" ? "No pudimos cerrar sesión. Intentá nuevamente." : "No pudimos iniciar sesión. Revisá tu conexión e intentá nuevamente.";
}
