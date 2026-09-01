/**
 * ============================================================
 * LSDAC ICT Duty Rota — Supabase Configuration
 * ============================================================
 * HOW TO GET YOUR CREDENTIALS:
 * 1. Go to https://supabase.com/dashboard
 * 2. Open your project
 * 3. Click "Settings" (gear icon) → "API"
 * 4. Copy "Project URL" and "anon / public" key below
 * ============================================================
 *
 * ALSO: Create the table in Supabase SQL Editor — run this SQL once:
 *
 *   CREATE TABLE rota_data (
 *     id TEXT PRIMARY KEY DEFAULT 'main',
 *     data JSONB NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   -- Allow public read/write (for now — you can lock this down later)
 *   ALTER TABLE rota_data ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Allow all" ON rota_data FOR ALL USING (true) WITH CHECK (true);
 *
 * ============================================================
 */

const SUPABASE_URL  = "https://kljvtekehkgvibtmvmpb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsanZ0ZWtlaGtndmlidG12bXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTc0OTQsImV4cCI6MjEwMzgzMzQ5NH0.gbPrEjJuBHtk9wIj3yvW23JicwLytY8xzAOMX34k3QQ";
