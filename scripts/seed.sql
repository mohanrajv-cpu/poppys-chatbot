-- Poppys Chatbot Database Schema
-- Run this against Vercel Postgres to set up the database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('po_creator', 'colour_manager', 'po_approver')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colour Bank (master list of approved colours)
CREATE TABLE IF NOT EXISTS colours (
  id SERIAL PRIMARY KEY,
  hex_code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'REJECTED')),
  added_by INTEGER REFERENCES users(id),
  source_po INTEGER,
  rejection_reason TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS pos (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  vendor_name VARCHAR(255),
  vendor_address TEXT,
  vendor_email VARCHAR(255),
  vendor_gst VARCHAR(50),
  place_of_delivery VARCHAR(255) DEFAULT 'POPPYS KNITWEAR [PADIYUR]',
  currency VARCHAR(10) DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR')),
  conversion_rate DECIMAL(10,4),
  terms_of_delivery TEXT,
  pay_terms TEXT,
  status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'PENDING_COLOUR_APPROVAL', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED'
  )),
  created_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PO Line Items
CREATE TABLE IF NOT EXISTS po_line_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES pos(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL,
  acc_name VARCHAR(255),
  style_no VARCHAR(255),
  colour_code VARCHAR(20) NOT NULL,
  colour_name VARCHAR(100) NOT NULL,
  size VARCHAR(50),
  uom VARCHAR(10) DEFAULT 'NOS' CHECK (uom IN ('NOS', 'KGS', 'MTRS', 'PCS')),
  qty INTEGER NOT NULL CHECK (qty > 0),
  rate DECIMAL(10,2),
  validation_status VARCHAR(30) CHECK (validation_status IN (
    'VALID', 'NAME_MISMATCH', 'UNKNOWN_CODE', 'PENDING_COLOUR'
  )),
  validation_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversations (chat history)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) DEFAULT 'New Conversation',
  method VARCHAR(20) CHECK (method IN ('quick_check', 'pdf_upload', 'po_creation')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'bot')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email Log
CREATE TABLE IF NOT EXISTS email_log (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  template VARCHAR(100),
  status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'BOUNCED')),
  related_entity_type VARCHAR(50),
  related_entity_id INTEGER,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_colours_hex_code ON colours(UPPER(hex_code));
CREATE INDEX IF NOT EXISTS idx_colours_status ON colours(status);
CREATE INDEX IF NOT EXISTS idx_pos_status ON pos(status);
CREATE INDEX IF NOT EXISTS idx_pos_created_by ON pos(created_by);
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Seed the 29 base Poppys colours
INSERT INTO colours (hex_code, name, status) VALUES
  ('FFCFCF', 'RED_25', 'ACTIVE'),
  ('F27979', 'RED_50', 'ACTIVE'),
  ('F03C3C', 'RED_75', 'ACTIVE'),
  ('942E2E', 'RED_100', 'ACTIVE'),
  ('FFDDB8', 'ORANGE_25', 'ACTIVE'),
  ('FFA53D', 'ORANGE_50', 'ACTIVE'),
  ('EB7D00', 'ORANGE_75', 'ACTIVE'),
  ('9C5300', 'ORANGE_100', 'ACTIVE'),
  ('FFFA91', 'YELLOW_25', 'ACTIVE'),
  ('F7E40F', 'YELLOW_50', 'ACTIVE'),
  ('BFA900', 'YELLOW_75', 'ACTIVE'),
  ('826D01', 'YELLOW_100', 'ACTIVE'),
  ('CCFFCC', 'GREEN_25', 'ACTIVE'),
  ('77F277', 'GREEN_50', 'ACTIVE'),
  ('49D649', 'GREEN_75', 'ACTIVE'),
  ('348734', 'GREEN_100', 'ACTIVE'),
  ('B8DFFF', 'BLUE_25', 'ACTIVE'),
  ('3BA6FF', 'BLUE_50', 'ACTIVE'),
  ('107ED9', 'BLUE_75', 'ACTIVE'),
  ('155387', 'BLUE_100', 'ACTIVE'),
  ('D7BDFF', 'PURPLE_25', 'ACTIVE'),
  ('9B7DC7', 'PURPLE_50', 'ACTIVE'),
  ('7944AB', 'PURPLE_75', 'ACTIVE'),
  ('501C82', 'PURPLE_100', 'ACTIVE'),
  ('DCDCDC', 'GRAY_25', 'ACTIVE'),
  ('A0A0A0', 'GRAY_50', 'ACTIVE'),
  ('787878', 'GRAY_75', 'ACTIVE'),
  ('505050', 'GRAY_100', 'ACTIVE'),
  ('FFFFFF', 'WHITE', 'ACTIVE')
ON CONFLICT (hex_code) DO NOTHING;
