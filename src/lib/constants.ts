import { Colour } from '@/types';

// Poppys brand palette
export const BRAND = {
  BLUE_100: '#155387',
  BLUE_75: '#107ed9',
  BLUE_50: '#3ba6ff',
  BLUE_25: '#b8dfff',
  GREEN_100: '#348734',
  ORANGE_100: '#9c5300',
  RED_100: '#942e2e',
  GRAY_75: '#787878',
  WHITE: '#ffffff',
} as const;

// The 29 base Poppys colours (seed data)
export const BASE_COLOURS: Omit<Colour, 'id' | 'added_by' | 'source_po' | 'rejection_reason' | 'created_at' | 'updated_at'>[] = [
  // RED family
  { hex_code: 'FFCFCF', name: 'RED_25', status: 'ACTIVE' },
  { hex_code: 'F27979', name: 'RED_50', status: 'ACTIVE' },
  { hex_code: 'F03C3C', name: 'RED_75', status: 'ACTIVE' },
  { hex_code: '942E2E', name: 'RED_100', status: 'ACTIVE' },
  // ORANGE family
  { hex_code: 'FFDDB8', name: 'ORANGE_25', status: 'ACTIVE' },
  { hex_code: 'FFA53D', name: 'ORANGE_50', status: 'ACTIVE' },
  { hex_code: 'EB7D00', name: 'ORANGE_75', status: 'ACTIVE' },
  { hex_code: '9C5300', name: 'ORANGE_100', status: 'ACTIVE' },
  // YELLOW family
  { hex_code: 'FFFA91', name: 'YELLOW_25', status: 'ACTIVE' },
  { hex_code: 'F7E40F', name: 'YELLOW_50', status: 'ACTIVE' },
  { hex_code: 'BFA900', name: 'YELLOW_75', status: 'ACTIVE' },
  { hex_code: '826D01', name: 'YELLOW_100', status: 'ACTIVE' },
  // GREEN family
  { hex_code: 'CCFFCC', name: 'GREEN_25', status: 'ACTIVE' },
  { hex_code: '77F277', name: 'GREEN_50', status: 'ACTIVE' },
  { hex_code: '49D649', name: 'GREEN_75', status: 'ACTIVE' },
  { hex_code: '348734', name: 'GREEN_100', status: 'ACTIVE' },
  // BLUE family
  { hex_code: 'B8DFFF', name: 'BLUE_25', status: 'ACTIVE' },
  { hex_code: '3BA6FF', name: 'BLUE_50', status: 'ACTIVE' },
  { hex_code: '107ED9', name: 'BLUE_75', status: 'ACTIVE' },
  { hex_code: '155387', name: 'BLUE_100', status: 'ACTIVE' },
  // PURPLE family
  { hex_code: 'D7BDFF', name: 'PURPLE_25', status: 'ACTIVE' },
  { hex_code: '9B7DC7', name: 'PURPLE_50', status: 'ACTIVE' },
  { hex_code: '7944AB', name: 'PURPLE_75', status: 'ACTIVE' },
  { hex_code: '501C82', name: 'PURPLE_100', status: 'ACTIVE' },
  // GRAY family
  { hex_code: 'DCDCDC', name: 'GRAY_25', status: 'ACTIVE' },
  { hex_code: 'A0A0A0', name: 'GRAY_50', status: 'ACTIVE' },
  { hex_code: '787878', name: 'GRAY_75', status: 'ACTIVE' },
  { hex_code: '505050', name: 'GRAY_100', status: 'ACTIVE' },
  // WHITE
  { hex_code: 'FFFFFF', name: 'WHITE', status: 'ACTIVE' },
];

export const ROLES = {
  PO_CREATOR: 'po_creator',
  COLOUR_MANAGER: 'colour_manager',
  PO_APPROVER: 'po_approver',
} as const;

export const PO_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  PENDING_COLOUR_APPROVAL: 'PENDING_COLOUR_APPROVAL',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
