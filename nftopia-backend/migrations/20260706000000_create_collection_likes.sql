-- Create collection likes table
CREATE TABLE IF NOT EXISTS collection_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collection_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX idx_collection_likes_collection_id ON collection_likes(collection_id);
CREATE INDEX idx_collection_likes_user_id ON collection_likes(user_id);

-- Create index for counting likes
CREATE INDEX idx_collection_likes_count ON collection_likes(collection_id, created_at DESC);