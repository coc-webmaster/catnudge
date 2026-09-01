CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  magic_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount REAL NOT NULL,
  suggested_category TEXT,
  selected_category TEXT,
  client_note TEXT,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_batch ON transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_token ON batches(magic_token);