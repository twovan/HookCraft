-- Migration: Admin Dashboard Tables
-- Creates tables needed for the admin dashboard features

-- 1. Operation Logs table (audit trail for admin actions)
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL,
  operator_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,       -- 'user' | 'content' | 'transaction' | 'system' | 'ai'
  operation_description TEXT NOT NULL,
  target_type TEXT,                   -- 'template' | 'user' | 'order' | 'setting' | etc.
  target_id TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operator_id ON operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type);

-- 2. Producer Invitations table
CREATE TABLE IF NOT EXISTS producer_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  expertise_tags TEXT[] DEFAULT '{}',
  revenue_share NUMERIC(5,4) NOT NULL DEFAULT 0.7000,
  expiry_days INTEGER NOT NULL DEFAULT 7,
  personal_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'expired' | 'revoked'
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producer_invitations_status ON producer_invitations(status);
CREATE INDEX IF NOT EXISTS idx_producer_invitations_email ON producer_invitations(invitee_email);

-- 3. Settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number TEXT NOT NULL UNIQUE,
  producer_id UUID NOT NULL,
  producer_name TEXT NOT NULL,
  template_sales_amount INTEGER NOT NULL DEFAULT 0,
  platform_commission INTEGER NOT NULL DEFAULT 0,
  settlement_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',  -- 'processing' | 'paid'
  settlement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_producer_id ON settlements(producer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- 4. Platform Settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Extend templates table with admin dashboard columns
ALTER TABLE templates ADD COLUMN IF NOT EXISTS producer_id UUID;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
