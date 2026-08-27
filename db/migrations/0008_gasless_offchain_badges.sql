BEGIN;

CREATE TABLE IF NOT EXISTS badge_offchain_attestations (
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
  eas_version smallint NOT NULL CHECK (eas_version = 2),
  domain_version text NOT NULL,
  eas_uid char(66) NOT NULL UNIQUE CHECK (eas_uid ~ '^0x[0-9a-f]{64}$'),
  attester_address char(42) NOT NULL CHECK (attester_address ~ '^0x[0-9A-Fa-f]{40}$'),
  signature char(132) NOT NULL CHECK (signature ~ '^0x[0-9a-f]{130}$'),
  salt char(66) NOT NULL CHECK (salt ~ '^0x[0-9a-f]{64}$'),
  encoded_data text NOT NULL CHECK (encoded_data ~ '^0x[0-9a-f]+$' AND length(encoded_data) % 2 = 0),
  signed_at bigint NOT NULL CHECK (signed_at > 0),
  expiration_time bigint NOT NULL DEFAULT 0 CHECK (expiration_time >= 0),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS badge_offchain_attestations_repository_commit_idx
  ON badge_offchain_attestations (repository_id, commit_sha);

COMMIT;
