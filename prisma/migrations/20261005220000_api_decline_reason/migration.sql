-- Adds API_DECLINE as a follow-up reason, for declines detected
-- automatically via NedarimPlus's standing-order reporting API rather than
-- a parsed email. Purely additive.

ALTER TYPE "FollowUpReason" ADD VALUE 'API_DECLINE';
