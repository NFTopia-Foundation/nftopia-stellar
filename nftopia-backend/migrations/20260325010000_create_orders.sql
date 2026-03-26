-- Migration for creating the orders table
CREATE TABLE IF NOT EXISTS "orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "nft_id" uuid NOT NULL,
    "buyer_id" uuid NOT NULL,
    "seller_id" uuid NOT NULL,
    "price" numeric(36, 18) NOT NULL,
    "currency" varchar(16) NOT NULL,
    "type" varchar(16) NOT NULL,
    "status" varchar(16) NOT NULL,
    "transaction_hash" varchar(128),
    "listing_id" uuid,
    "auction_id" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_nft FOREIGN KEY (nft_id) REFERENCES nft(id),
    CONSTRAINT fk_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES users(id),
    CONSTRAINT fk_listing FOREIGN KEY (listing_id) REFERENCES listing(id),
    CONSTRAINT fk_auction FOREIGN KEY (auction_id) REFERENCES auction(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_nft_id ON "orders" ("nft_id");
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON "orders" ("buyer_id");
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON "orders" ("seller_id");
CREATE INDEX IF NOT EXISTS idx_orders_type ON "orders" ("type");
CREATE INDEX IF NOT EXISTS idx_orders_status ON "orders" ("status");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON "orders" ("created_at");
