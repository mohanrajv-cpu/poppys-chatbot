export type UserRole = 'po_creator' | 'colour_manager' | 'po_approver';

export type ColourStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

export type POStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_COLOUR_APPROVAL'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type ValidationVerdict = 'VALID' | 'NAME_MISMATCH' | 'UNKNOWN_CODE' | 'PENDING_COLOUR';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Colour {
  id: number;
  hex_code: string;
  name: string;
  status: ColourStatus;
  added_by: number | null;
  source_po: number | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PO {
  id: number;
  po_number: string;
  po_date: string;
  delivery_date: string;
  vendor_name: string;
  vendor_address: string;
  vendor_email: string | null;
  vendor_gst: string | null;
  place_of_delivery: string;
  currency: 'INR' | 'USD' | 'EUR';
  conversion_rate: number | null;
  terms_of_delivery: string | null;
  pay_terms: string | null;
  status: POStatus;
  created_by: number;
  approved_by: number | null;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: number;
  po_id: number;
  sno: number;
  acc_name: string;
  style_no: string | null;
  colour_code: string;
  colour_name: string;
  size: string | null;
  uom: 'NOS' | 'KGS' | 'MTRS' | 'PCS';
  qty: number;
  rate: number | null;
  validation_status: ValidationVerdict;
  validation_message: string | null;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  method: 'quick_check' | 'pdf_upload' | 'po_creation' | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'bot';
  content: string;
  metadata: MessageMetadata | null;
  created_at: string;
}

export type MessageMetadata =
  | { type: 'validation_result'; lines: ValidationLine[] }
  | { type: 'suggestion_chips'; chips: SuggestionChip[] }
  | { type: 'colour_added'; hex_code: string; name: string }
  | { type: 'po_submitted'; po_id: number; po_number: string }
  | { type: 'pdf_preview'; po_id: number; url: string }
  | { type: 'add_colour_prompt'; hex_code: string }
  | { type: 'name_mismatch_prompt'; hex_code: string; entered_name: string; correct_name: string };

export interface ValidationLine {
  sno: number;
  colour_code: string;
  entered_name: string;
  official_name: string | null;
  status: ColourStatus | null;
  verdict: ValidationVerdict;
}

export interface SuggestionChip {
  label: string;
  action: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface EmailLogEntry {
  id: number;
  to_email: string;
  subject: string;
  template: string;
  status: 'SENT' | 'FAILED' | 'BOUNCED';
  related_entity_type: string | null;
  related_entity_id: number | null;
  sent_at: string;
}
