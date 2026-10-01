import type { ProductRow } from "@/types/database";

export type ProductInput = Pick<ProductRow, "name" | "description" | "category_id" | "brand" | "model" | "sku" | "price" | "stock_quantity" | "pickup_enabled" | "delivery_enabled" | "active">;
// Keep number inputs as text while editing: an empty required field is not zero.
export type ProductFormValues = Omit<ProductInput, "price" | "stock_quantity"> & { price: string; stock_quantity: string };

export function productFormValues(product?: ProductRow | null): ProductFormValues {
  return {
    name: product?.name ?? "", description: product?.description ?? "", category_id: product?.category_id ?? "",
    brand: product?.brand ?? "", model: product?.model ?? "", sku: product?.sku ?? "",
    price: product ? String(product.price) : "", stock_quantity: product ? String(product.stock_quantity) : "0",
    pickup_enabled: product?.pickup_enabled ?? true, delivery_enabled: product?.delivery_enabled ?? false, active: product?.active ?? true,
  };
}

export function validateProduct(form: ProductFormValues, categoryIds: string[]): string {
  if (!form.name.trim() || form.name.trim().length > 160) return "Ingresá un nombre de hasta 160 caracteres.";
  if (!categoryIds.includes(form.category_id)) return "Seleccioná una categoría válida.";
  const price = Number(form.price);
  if (!form.price.trim() || !Number.isFinite(price) || price < 0 || price > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(form.price)) return "Ingresá un precio mayor o igual a 0, con hasta dos decimales.";
  const stock = Number(form.stock_quantity);
  if (!form.stock_quantity.trim() || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) return "Ingresá un stock entero mayor o igual a 0.";
  if (form.description.length > 5000 || (form.brand?.length ?? 0) > 160 || (form.model?.length ?? 0) > 160 || (form.sku?.length ?? 0) > 100) return "Revisá la longitud de la descripción, marca, modelo o SKU.";
  return "";
}

export function normalizeProduct(form: ProductFormValues): ProductInput {
  return {
    name: form.name.trim(), description: form.description.trim(), category_id: form.category_id,
    brand: form.brand?.trim() || null, model: form.model?.trim() || null, sku: form.sku?.trim() || null,
    price: Number(form.price), stock_quantity: Number(form.stock_quantity),
    pickup_enabled: form.pickup_enabled, delivery_enabled: form.delivery_enabled, active: form.active,
  };
}

export function productErrorMessage(cause: unknown): string {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
  if (code === "23505") return "Ya existe un producto con ese SKU en tu comercio. Usá otro o dejalo vacío.";
  if (message.includes("product_not_owned")) return "No encontramos ese producto en tu comercio o ya no tenés acceso.";
  if (message.includes("product_business_required")) return "Necesitás crear tu comercio antes de publicar productos.";
  if (code === "42501" || message.includes("product_auth_required")) return "No pudimos autorizar la operación. Revisá tu sesión y que el producto sea de tu comercio.";
  if (code === "PGRST202" || code === "42883") return "Falta habilitar la gestión de productos en Supabase. Ejecutá product-rls.sql.";
  if (code === "22023" || code === "22P02" || code === "23514" || code === "23503") return "Revisá los campos, el precio, el stock y la categoría seleccionada.";
  return "No pudimos guardar el producto. Revisá tu conexión e intentá nuevamente.";
}
