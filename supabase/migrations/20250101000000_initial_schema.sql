-- Profiles: one per account+chain combination
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  chain_id text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_name, chain_id)
);

-- User settings: LLM config, preferences
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  llm_provider text,
  llm_model text,
  llm_api_key text,
  preferred_chains jsonb DEFAULT '[]',
  ui_preferences jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Bookmarks: saved card snapshots
CREATE TABLE bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tool_name text NOT NULL,
  label text NOT NULL,
  result jsonb NOT NULL,
  chain_name text,
  chain_endpoint text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "service can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users manage own settings"
  ON user_settings FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "users manage own bookmarks"
  ON bookmarks FOR ALL
  USING (user_id = auth.uid());
