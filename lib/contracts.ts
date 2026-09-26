export type Confidence = "high" | "medium" | "low";

export interface RC {
  document_type: "rc"; source: string;
  registration_number: string; registration_date: string | null;
  chassis_number: string; engine_number?: string; owner_name?: string;
  owner_serial: number | null; maker?: string; model?: string; fuel?: string;
  financier?: string | null; confidence: Confidence; low_confidence_fields?: string[];
  [k: string]: unknown;
}

export interface ServiceEntry {
  date: string | null; odometer_km: number | null; service_type?: string | null;
  dealer?: string | null; source: string; confidence: Confidence;
  low_confidence_fields?: string[]; notes?: string | null;
}

export interface ServiceBook {
  document_type: "service_book";
  vehicle?: {
    registration_number?: string | null; chassis_number?: string | null;
    date_of_sale?: string | null; source?: string;
  };
  entries: ServiceEntry[];
}

export interface Insurance {
  document_type: "insurance"; source: string; policy_number: string; insurer?: string;
  registration_number?: string; chassis_number?: string;
  period_start: string | null; period_end: string | null;
  ncb_percent?: number | null; previous_policy_number?: string | null;
  confidence: Confidence; low_confidence_fields?: string[];
}

export interface Extraction {
  rc: RC | null;
  service_book: ServiceBook | null;
  insurance: Insurance[];
}

export interface SellerClaim { claimed_owners: number | null; raw_text?: string; }

export type TLType = "registration" | "service" | "insurance_start" | "insurance_end";

export interface TLEvent {
  date: string; type: TLType; odometer_km?: number | null; source: string;
  note?: string | null; service_type?: string | null; policy_number?: string;
}

export interface Flag {
  rule: string; severity: "high" | "medium" | "low";
  entries?: string[]; explanation: string;
  // rule-specific extras: values_km, sources, gap_days, gap_km, uninsured_days, policies, context, ...
  [k: string]: unknown;
}

export interface CarFacts {
  make?: string; model?: string; year?: number; fuel?: string;
  reg_number?: string; chassis?: string;
  owner_count_paper?: number; owner_count_record?: number;
  current_odometer_km?: number; asking_price_inr?: number;
}

export interface PartRisk {
  part: string; priority: "high" | "low"; est_cost_inr: number;
  status: "overdue" | "due_soon" | "ok"; reason: string;
}

export interface PriceComp { source: string; title: string; price_inr: number; url: string; }

export interface Report {
  car: CarFacts;
  timeline: TLEvent[];
  flags: Flag[];
  unreadable_notices: { source: string; field: string; message: string }[];
  questions: { rule: string; question: string }[];
  part_risks: PartRisk[];
  price_comps: PriceComp[];
}
