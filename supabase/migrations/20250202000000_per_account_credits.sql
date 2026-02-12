-- Per-account credit balances: credits are tied to chain_id + account_name
-- instead of user_id. Users pay with TLOS on Telos Mainnet but can
-- credit any chain+account pair.

-- credit_balances: make user_id nullable, add chain+account columns, new unique key
ALTER TABLE credit_balances ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE credit_balances ADD COLUMN chain_id text;
ALTER TABLE credit_balances ADD COLUMN account_name text;
ALTER TABLE credit_balances DROP CONSTRAINT credit_balances_user_id_key;
ALTER TABLE credit_balances ADD CONSTRAINT credit_balances_chain_account_key UNIQUE (chain_id, account_name);

-- daily_usage: make user_id nullable, add chain+account columns, update unique constraint
ALTER TABLE daily_usage ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE daily_usage ADD COLUMN chain_id text;
ALTER TABLE daily_usage ADD COLUMN account_name text;
ALTER TABLE daily_usage DROP CONSTRAINT daily_usage_user_id_date_key;
ALTER TABLE daily_usage ADD CONSTRAINT daily_usage_chain_account_date_key UNIQUE (chain_id, account_name, date);

-- credit_transactions: make user_id nullable, add chain+account for audit trail
ALTER TABLE credit_transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE credit_transactions ADD COLUMN chain_id text;
ALTER TABLE credit_transactions ADD COLUMN account_name text;
