ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(56) UNIQUE,
ADD COLUMN IF NOT EXISTS wallet_public_key VARCHAR(56),
ADD COLUMN IF NOT EXISTS wallet_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS wallet_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    wallet_address VARCHAR(56) NOT NULL,
    wallet_provider VARCHAR(50),
    nonce VARCHAR(255) NOT NULL,
    challenge_message TEXT NOT NULL,
    nonce_expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    ip_address VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_sessions_wallet_address ON wallet_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_nonce ON wallet_sessions(nonce);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_user_id ON wallet_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(56) NOT NULL,
    wallet_provider VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, wallet_address),
    UNIQUE(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);
