-- #652: optional per-auction override for the minimum bid increment,
-- expressed as a fraction of the current highest bid (e.g. 0.05 = 5%).
-- NULL means the platform-wide default applies.
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS min_bid_increment_pct DECIMAL(5, 4);
