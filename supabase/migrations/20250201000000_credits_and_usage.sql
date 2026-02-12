-- Credit balances: per-user prepaid token balance
CREATE TABLE credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance_tokens bigint DEFAULT 0,
  total_deposited_tlos numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Credit transactions: immutable ledger of deposits and usage
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'usage')),
  tlos_amount numeric,
  tx_hash text,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  model text,
  token_units_delta bigint NOT NULL,
  balance_after bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_credit_transactions_tx_hash ON credit_transactions(tx_hash) WHERE tx_hash IS NOT NULL;

-- Daily usage: free tier tracking
CREATE TABLE daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer DEFAULT 0,
  total_input_tokens bigint DEFAULT 0,
  total_output_tokens bigint DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_usage_user_date ON daily_usage(user_id, date DESC);

-- Add llm_mode column to user_settings
ALTER TABLE user_settings ADD COLUMN llm_mode text DEFAULT 'builtin' CHECK (llm_mode IN ('builtin', 'byok'));

-- Enable RLS
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own rows
CREATE POLICY "users read own credit balance"
  ON credit_balances FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users read own credit transactions"
  ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users read own daily usage"
  ON daily_usage FOR SELECT
  USING (user_id = auth.uid());

-- Service role handles all mutations via admin client
CREATE POLICY "service insert credit balances"
  ON credit_balances FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service update credit balances"
  ON credit_balances FOR UPDATE
  USING (true);

CREATE POLICY "service insert credit transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service insert daily usage"
  ON daily_usage FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service update daily usage"
  ON daily_usage FOR UPDATE
  USING (true);
