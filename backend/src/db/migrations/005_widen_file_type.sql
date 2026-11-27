-- 005: document_versions.file_type holds the uploaded MIME type.
-- VARCHAR(50) was too short for real MIME types such as
-- "application/vnd.openxmlformats-officedocument.wordprocessingml.document" (71 chars),
-- which made every browser DOCX upload fail. RFC 6838 allows up to 255 characters.
-- Widening a VARCHAR is a metadata-only change in PostgreSQL (no table rewrite).
ALTER TABLE document_versions ALTER COLUMN file_type TYPE VARCHAR(255);
