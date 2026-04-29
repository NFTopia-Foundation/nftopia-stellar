-- CreateTable
CREATE TABLE IF NOT EXISTS "collection_stats" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "collection_id" uuid NOT NULL,
    "date" date NOT NULL,
    "volume" decimal(20,7) NOT NULL DEFAULT 0,
    "floor_price" decimal(20,7) NOT NULL DEFAULT 0,
    "sales_count" integer NOT NULL DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    CONSTRAINT "uq_collection_stats_collection_id_date" UNIQUE ("collection_id", "date"),
    CONSTRAINT "fk_collection_stats_collection_id" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_collection_stats_collection_id" ON "collection_stats" ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_collection_stats_date" ON "collection_stats" ("date");
