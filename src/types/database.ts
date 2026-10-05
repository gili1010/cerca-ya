/** Hand-maintained schema contract for supabase/schema.sql, not generated remotely.
 * Keep UI/demo models unchanged. Generate this file from Supabase when migration starts.
 * SQL numeric values are represented as number; timestamptz and UUID as strings.
 */
import type { ReservationStatus } from "./reservations";
import type { RequestStatus } from "./requests";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";
export type InventoryMode = "STOCKED" | "ON_DEMAND";
export type DatabaseNeededWhen = "TODAY" | "TOMORROW" | "THIS_WEEK" | "FLEXIBLE";
export type DatabaseRequestStatus = RequestStatus | "EXPIRED";
// ACTIVE/EXPIRED remain readable for compatibility with the initial database enum.
export type DatabaseOfferStatus = "PENDING" | "ACTIVE" | "WITHDRAWN" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type DatabaseDeliveryType = "PICKUP" | "DELIVERY";
export type PaymentMethod = "CASH" | "TRANSFER" | "ARRANGE";

type Timestamps = { created_at: string; updated_at: string };
export type ProfileRow = Timestamps & { id: string; full_name: string; phone: string | null; avatar_url: string | null };
export type BusinessRow = Timestamps & {
  id: string; owner_id: string | null; name: string; slug: string; description: string;
  logo_url: string | null; cover_url: string | null;
  whatsapp: string | null; address: string | null; city: string | null; latitude: number | null; longitude: number | null;
  pickup_enabled: boolean; delivery_enabled: boolean; delivery_radius_km: number; delivery_price: number; minimum_order: number;
  verified: boolean; active: boolean;
  accepts_cash: boolean; accepts_transfer: boolean; transfer_alias: string | null;
};
export type CategoryRow = { id: string; name: string; slug: string; parent_id: string | null; icon: string | null; created_at: string };
export type BusinessCategoryRow = { business_id: string; category_id: string };
export type ProductRow = Timestamps & {
  id: string; business_id: string; category_id: string; name: string; description: string;
  brand: string | null; model: string | null; sku: string | null; price: number;
  stock_quantity: number; stock_status: StockStatus; stock_confirmed_at: string | null;
  inventory_mode: InventoryMode; available_today: boolean; availability_confirmed_at: string | null;
  pickup_enabled: boolean; delivery_enabled: boolean; active: boolean;
};
export type ProductImageRow = { id: string; product_id: string; url: string; position: number; created_at: string };
export type RequestRow = {
  id: string; buyer_id: string; title: string; description: string; category_id: string;
  latitude: number | null; longitude: number | null; radius_km: number; needed_when: DatabaseNeededWhen;
  image_url: string | null; status: DatabaseRequestStatus; created_at: string; expires_at: string;
};
export type OfferRow = {
  id: string; request_id: string; business_id: string; product_id: string | null;
  product_name: string; description: string; price: number; pickup_available: boolean; delivery_available: boolean;
  delivery_price: number; estimated_delivery: string; alternative: boolean; status: DatabaseOfferStatus; created_at: string;
};
export type RadarRequestRow = Pick<RequestRow, "id" | "title" | "description" | "category_id" | "needed_when" | "radius_km" | "created_at" | "expires_at"> & {
  category_name: string; offers_count: number; my_offer_id: string | null; distance_km: number | null;
};
export type PublicOfferRow = OfferRow & { business_name: string; business_city: string | null; business_whatsapp: string | null };
export type ReservationRow = {
  id: string; buyer_id: string; business_id: string; product_id: string; quantity: number;
  unit_price: number; delivery_price: number; total: number; delivery_type: DatabaseDeliveryType; status: ReservationStatus;
  created_at: string; expires_at: string; confirmed_at: string | null; ready_at: string | null;
  completed_at: string | null; cancelled_at: string | null;
  inventory_mode: InventoryMode;
};
export type FavoriteRow = { user_id: string; product_id: string; created_at: string };
export type ReservationView = Omit<ReservationRow, "buyer_id"> & {
  product_name: string; business_name: string; product_image: string | null; current_stock: number;
  customer_name: string | null; customer_phone: string | null;
  delivery_address: string | null; delivery_city: string | null; delivery_reference: string | null;
  customer_notes: string | null; payment_method: PaymentMethod | null; transfer_alias: string | null;
  pickup_address: string | null; pickup_city: string | null;
};
export type SearchEventRow = {
  id: string; user_id: string | null; query: string; latitude: number | null; longitude: number | null;
  results_count: number; created_at: string;
};

type Relationship = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
type FK<Name extends string, Columns extends string[], Relation extends string, References extends string[] = ["id"]> = {
  foreignKeyName: Name; columns: Columns; isOneToOne: false; referencedRelation: Relation; referencedColumns: References;
};
type Table<Row, Required extends keyof Row, Relations extends Relationship[] = [], Generated extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>;
  Update: Partial<Omit<Row, Generated>>;
  Relationships: Relations;
};

// Types describe storage, not authorization: SQL column grants and RLS remain authoritative.
export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      businesses: Table<BusinessRow, "name" | "slug", [FK<"businesses_owner_id_fkey", ["owner_id"], "profiles">]>;
      categories: Table<CategoryRow, "name" | "slug", [FK<"categories_parent_id_fkey", ["parent_id"], "categories">]>;
      business_categories: Table<BusinessCategoryRow, "business_id" | "category_id", [
        FK<"business_categories_business_id_fkey", ["business_id"], "businesses">,
        FK<"business_categories_category_id_fkey", ["category_id"], "categories">
      ]>;
      products: Table<ProductRow, "business_id" | "category_id" | "name" | "price", [
        FK<"products_business_id_fkey", ["business_id"], "businesses">,
        FK<"products_category_id_fkey", ["category_id"], "categories">
      ]>;
      product_images: Table<ProductImageRow, "product_id" | "url", [FK<"product_images_product_id_fkey", ["product_id"], "products">]>;
      requests: Table<RequestRow, "buyer_id" | "title" | "category_id", [
        FK<"requests_buyer_id_fkey", ["buyer_id"], "profiles">,
        FK<"requests_category_id_fkey", ["category_id"], "categories">
      ]>;
      offers: Table<OfferRow, "request_id" | "business_id" | "product_name" | "description" | "price", [
        FK<"offers_request_id_fkey", ["request_id"], "requests">,
        FK<"offers_business_id_fkey", ["business_id"], "businesses">,
        FK<"offers_product_business_fkey", ["product_id", "business_id"], "products", ["id", "business_id"]>
      ]>;
      reservations: Table<ReservationRow, "buyer_id" | "business_id" | "product_id" | "quantity" | "unit_price" | "delivery_type", [
        FK<"reservations_buyer_id_fkey", ["buyer_id"], "profiles">,
        FK<"reservations_business_id_fkey", ["business_id"], "businesses">,
        FK<"reservations_product_business_fkey", ["product_id", "business_id"], "products", ["id", "business_id"]>
      ], "total">;
      favorites: Table<FavoriteRow, "user_id" | "product_id", [
        FK<"favorites_user_id_fkey", ["user_id"], "profiles">,
        FK<"favorites_product_id_fkey", ["product_id"], "products">
      ]>;
      search_events: Table<SearchEventRow, "query", [FK<"search_events_user_id_fkey", ["user_id"], "profiles">]>;
    };
    Views: { [_ in never]: never };
    Functions: {
      read_marketplace_page: {
        Args: { p_query?: string; p_category?: string; p_filters?: string[]; p_sort?: string; p_home?: boolean; p_favorite_ids?: string[] | null; p_latitude?: number | null; p_longitude?: number | null; p_offset?: number; p_limit?: number };
        Returns: { product_ids: string[]; total: number }[];
      };
      save_my_store_branding: {
        Args: { p_description: string; p_logo_url: string | null; p_cover_url: string | null; p_expected_description: string; p_expected_logo_url: string | null; p_expected_cover_url: string | null };
        Returns: undefined;
      };
      create_my_reservation: {
        Args: { p_reservation_id: string; p_product_id: string; p_quantity: number; p_delivery_type: DatabaseDeliveryType; p_checkout?: Json };
        Returns: string;
      };
      manage_my_reservation: { Args: { p_reservation_id: string; p_action: "confirm" | "cancel" | "ready" | "complete" }; Returns: string };
      read_my_reservations: {
        Args: { p_seller?: boolean; p_reservation_id?: string | null; p_offset?: number; p_limit?: number };
        Returns: ReservationView[];
      };
      read_radar: {
        Args: { p_request_id?: string | null; p_offset?: number; p_limit?: number };
        Returns: RadarRequestRow[];
      };
      read_offers: {
        Args: { p_request_id?: string | null; p_offer_id?: string | null; p_seller?: boolean; p_offset?: number; p_limit?: number };
        Returns: PublicOfferRow[];
      };
      create_my_offer: {
        Args: { p_request_id: string; p_product_id: string | null; p_product_name: string; p_description: string; p_price: number; p_pickup_available: boolean; p_delivery_available: boolean; p_delivery_price: number; p_estimated_delivery: string; p_alternative: boolean };
        Returns: string;
      };
      withdraw_my_offer: { Args: { p_offer_id: string }; Returns: string };
      create_my_request: {
        Args: { p_request_id: string; p_title: string; p_description: string; p_category_id: string; p_radius_km: number; p_needed_when: DatabaseNeededWhen; p_latitude?: number | null; p_longitude?: number | null };
        Returns: string;
      };
      set_my_product_photo: {
        Args: { p_product_id: string; p_url: string | null; p_expected_url: string | null };
        Returns: undefined;
      };
      save_my_product: {
        Args: { p_input: Json; p_product_id?: string | null };
        Returns: string;
      };
      manage_my_product: {
        Args: { p_product_id: string; p_action: "confirm_stock" | "activate" | "deactivate" };
        Returns: ProductRow;
      };
      save_my_business: {
        Args: { p_input: Json; p_category_ids: string[]; p_business_id?: string | null };
        Returns: string;
      };
    };
    Enums: {
      stock_status: StockStatus; request_needed_when: DatabaseNeededWhen; request_status: DatabaseRequestStatus;
      offer_status: DatabaseOfferStatus; delivery_type: DatabaseDeliveryType; reservation_status: ReservationStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<Name extends TableName> = Database["public"]["Tables"][Name]["Row"];
export type Insert<Name extends TableName> = Database["public"]["Tables"][Name]["Insert"];
export type Update<Name extends TableName> = Database["public"]["Tables"][Name]["Update"];
