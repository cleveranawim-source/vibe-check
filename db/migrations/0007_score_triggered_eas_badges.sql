BEGIN;

CREATE TABLE IF NOT EXISTS badge_attestations (
  id uuid PRIMARY KEY,
  subject_key char(66) NOT NULL UNIQUE CHECK (subject_key ~ '^0x[0-9a-f]{64}$'),
  repository_id text NOT NULL CHECK (repository_id ~ '^[0-9]+$'),
  repository_url text NOT NULL CHECK (repository_url ~ '^https://github[.]com/'),
  commit_sha char(40) NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  badge_level text NOT NULL CHECK (badge_level IN ('silver', 'gold')),
  report_hash char(66) NOT NULL CHECK (report_hash ~ '^0x[0-9a-f]{64}$'),
  policy_hash char(66) NOT NULL CHECK (policy_hash ~ '^0x[0-9a-f]{64}$'),
  policy_version text NOT NULL,
  ruleset_version text NOT NULL,
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  eas_contract char(42) NOT NULL CHECK (eas_contract ~ '^0x[0-9A-Fa-f]{40}$'),
  schema_uid char(66) NOT NULL CHECK (schema_uid ~ '^0x[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('submitting', 'submitted', 'issued', 'failed', 'submission_unknown')),
  attempt_count smallint NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  eas_uid char(66) UNIQUE CHECK (eas_uid IS NULL OR eas_uid ~ '^0x[0-9a-f]{64}$'),
  tx_hash char(66) UNIQUE CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  attester_address char(42) NOT NULL CHECK (attester_address ~ '^0x[0-9A-Fa-f]{40}$'),
  expires_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state = 'submitting' AND eas_uid IS NULL)
    OR (state IN ('submitted', 'submission_unknown') AND tx_hash IS NOT NULL AND eas_uid IS NULL)
    OR (state = 'issued' AND tx_hash IS NOT NULL AND eas_uid IS NOT NULL)
    OR (state = 'failed' AND eas_uid IS NULL AND failure_code IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS badge_attestations_repository_commit_idx
  ON badge_attestations (repository_id, commit_sha);

COMMIT;
