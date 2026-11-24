-- Additive migration: private KYC document storage.
--
-- Document bytes live only in Postgres and are served through an authorised
-- route, never from a public URL. A SHA-256 digest lets staff confirm a file was
-- not swapped after review. Small files only: the API enforces a 5 MiB limit.

CREATE TABLE IF NOT EXISTS kyc_document_blobs (
  document_id UUID PRIMARY KEY REFERENCES kyc_documents(id) ON DELETE CASCADE,
  content BYTEA NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('0010_kyc_blobs')
ON CONFLICT (version) DO NOTHING;
