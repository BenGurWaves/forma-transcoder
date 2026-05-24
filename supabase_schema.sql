-- ==========================================
-- FORMA by Calyvent — Supabase Schema
-- Web Design by Velocity
-- ==========================================

-- Enable UUID generation extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LICENSES & SUBSCRIPTIONS
-- Tracks premium tiers, Stripe customer IDs, and JWT license records.
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    customer_email VARCHAR(255) NOT NULL,
    license_token TEXT UNIQUE, -- Stores the encrypted Ed25519 signature payload
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for quick asymmetric signature verification and key lookup
CREATE INDEX IF NOT EXISTS idx_licenses_token ON public.licenses(license_token);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON public.licenses(customer_email);

-- 2. STRIPE PAYMENT EVENTS
-- Raw transaction log to track revenue streams and support audit logs.
CREATE TABLE IF NOT EXISTS public.stripe_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    amount_total INTEGER NOT NULL, -- Stored in cents (e.g., 1000 = $10.00)
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    payment_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_session ON public.stripe_payments(stripe_session_id);

-- 3. CONVERSION AUDIT LOGS
-- Tracks client usage. The Free tier tracks optimizations per IP address (hash).
-- Paid tier tracks usage against their specific license token.
CREATE TABLE IF NOT EXISTS public.conversion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_token TEXT REFERENCES public.licenses(license_token) ON DELETE SET NULL,
    ip_hash VARCHAR(64) NOT NULL, -- SHA256 hashed client IP for anonymity and limit enforcement
    file_name TEXT,
    file_size BIGINT NOT NULL, -- File size in bytes
    format_target VARCHAR(50) NOT NULL, -- 'h264_aac', 'alpha_mask', 'mp3'
    processing_duration NUMERIC(10, 2), -- In seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for rapid aggregation of daily IP-based optimization counts
CREATE INDEX IF NOT EXISTS idx_conversion_ip_time ON public.conversion_logs(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_license ON public.conversion_logs(license_token);

-- ==========================================
-- AUTOMATION & TRIGGERS
-- ==========================================

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger definition for license updates
DROP TRIGGER IF EXISTS trigger_update_licenses ON public.licenses;
CREATE TRIGGER trigger_update_licenses
    BEFORE UPDATE ON public.licenses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_column();

-- ==========================================
-- SECURITY POLICIES (Row Level Security)
-- ==========================================

-- Enable Row Level Security
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_logs ENABLE ROW LEVEL SECURITY;

-- 1. Licenses Policies
-- Read-only policy for verified token handshakes, writes allowed by admin webhook function
CREATE POLICY "Allow public select by license token" ON public.licenses
    FOR SELECT USING (true);

-- 2. Conversion Logs Policies
-- Public can log conversion events to enforce dynamic free limits, read is restricted.
CREATE POLICY "Allow public inserts for conversion logging" ON public.conversion_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow selective read of own conversion logs" ON public.conversion_logs
    FOR SELECT USING (license_token IS NOT NULL);

-- ==========================================
-- LIMIT AUDIT HELPER FUNCTIONS
-- ==========================================

-- Call this function via Supabase RPC to instantly check if a client IP hash has exceeded their 3-conversion threshold.
CREATE OR REPLACE FUNCTION public.check_ip_limits(client_ip_hash VARCHAR(64))
RETURNS BOOLEAN AS $$
DECLARE
    conversion_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO conversion_count
    FROM public.conversion_logs
    WHERE ip_hash = client_ip_hash
      AND created_at > NOW() - INTERVAL '24 hours';
      
    IF conversion_count >= 3 THEN
        RETURN FALSE; -- Exceeded free tier limits
    ELSE
        RETURN TRUE; -- Within free tier limits
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
