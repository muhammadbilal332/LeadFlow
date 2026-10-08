-- Tracks whether a reply has been opened yet, so the Inbox can highlight
-- unread conversations (Gmail-style). Purely additive; defaults every
-- existing reply to unread, which is the honest state since nothing has
-- ever marked one read before this column existed.
ALTER TABLE email_replies ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_replies_business_unread ON email_replies(business_id, is_read);
