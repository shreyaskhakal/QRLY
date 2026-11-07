/**
 * Core Domain & Database Types for QR Print Kiosk (QRLY)
 */

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "queued"
  | "printing"
  | "done"
  | "failed"
  | "expired"
  | "refunded";

export type JobStatus =
  | "queued"
  | "claimed"
  | "printing"
  | "done"
  | "failed"
  | "cancelled";

export type PrinterStatus = "online" | "offline" | "error";

export type ColorMode = "bw" | "color";

export type PrintQuality = "draft" | "normal" | "high";

export type PageSides = "single" | "double";

export interface Shop {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
  bw_price_paise: number;
  color_price_paise: number;
  q_draft_mult: number;
  q_normal_mult: number;
  q_high_mult: number;
  max_file_mb: number;
  order_expiry_minutes: number;
  accepting_orders: boolean;
  agent_key_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  shop_id: string;
  system_name: string;
  supports_color: boolean;
  supports_duplex: boolean;
  status: PrinterStatus;
  status_detail: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  shop_id: string;
  token_label: string | null;
  guest_secret_hash: string;
  status: OrderStatus;
  total_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  expires_at: string;
  files_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFile {
  id: string;
  order_id: string;
  original_name: string;
  storage_path: string | null;
  mime_type: string;
  size_bytes: number;
  page_count: number;
  color_mode: ColorMode;
  quality: PrintQuality;
  copies: number;
  page_range: string | null;
  selected_pages: number;
  sides: PageSides;
  price_paise: number;
  deleted_at: string | null;
  delete_verified: boolean;
  created_at: string;
}

export interface PrintJob {
  id: string;
  order_id: string;
  order_file_id: string;
  shop_id: string;
  printer_id: string | null;
  status: JobStatus;
  attempts: number;
  claimed_at: string | null;
  claim_expires_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  agent_local_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentEvent {
  id: string;
  razorpay_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

export interface FileOptionsInput {
  colorMode: ColorMode;
  quality: PrintQuality;
  copies: number;
  pageRange?: string | null;
  sides: PageSides;
}

export interface PriceCalculationInput {
  selectedPages: number;
  copies: number;
  colorMode: ColorMode;
  quality: PrintQuality;
}

export interface ShopPricingRules {
  bw_price_paise: number;
  color_price_paise: number;
  q_draft_mult: number;
  q_normal_mult: number;
  q_high_mult: number;
}

export interface PriceCalculationResult {
  pricePaise: number;
  unitRatePaise: number;
  qualityMultiplier: number;
  billablePages: number;
}

export interface PageRangeParseResult {
  valid: boolean;
  pages: number[];
  selectedCount: number;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

