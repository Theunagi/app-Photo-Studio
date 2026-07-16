-- ============================================================
-- Idempotency guard for on-demand credit provisioning
-- ============================================================
-- FIX (security): provision-credits is callable on demand by any
-- authenticated user. For recurring subscription / entitlement sources it
-- reset points_balance to the full plan amount on EVERY call, with no
-- per-period guard — a subscriber could spend credits then call it again to
-- refill, unlimited times per billing period.
--
-- This table records one provision per (user, period). The edge function
-- claims a row (INSERT) before provisioning; a PK conflict means the plan
-- was already provisioned for that period and the balance is left untouched.
-- Mirrors the webhook_events idempotency pattern.
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_provisions (
  user_id       uuid NOT NULL,
  period_key    text NOT NULL,   -- e.g. "starter:2026-07" (plan + billing month)
  plan          text NOT NULL,
  credits       integer NOT NULL,
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_key)
);

-- RLS on, no policies => only service_role (edge functions) can read/write.
ALTER TABLE credit_provisions ENABLE ROW LEVEL SECURITY;
