-- App-level configuration (non-secret values manageable from Supabase dashboard)
CREATE TABLE app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Seed default values
INSERT INTO app_config (key, value, description) VALUES
  ('chutes_default_model', 'deepseek-ai/DeepSeek-V3-0324', 'Default Chutes model for built-in LLM'),
  ('chutes_fallback_model', 'deepseek-ai/DeepSeek-R1', 'Fallback model when primary is down'),
  ('app_wallet_account', '', 'Telos mainnet account that receives TLOS credit payments');

-- RLS: read-only for everyone, only service role can write
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read app config"
  ON app_config FOR SELECT
  USING (true);
