-- Forward-only migration: add support for legacy Word .doc uploads.
-- Rollback safety: deploy application code that stops DOC writes and drains
-- workers before applying any separately reviewed compensating migration.

ALTER TYPE "CvDocumentKind" ADD VALUE IF NOT EXISTS 'DOC';

ALTER TABLE "CvUpload" DROP CONSTRAINT IF EXISTS "CvUpload_declared_bytes";
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_declared_bytes"
  CHECK (
    "declaredBytes" BETWEEN 1 AND 5000000 AND
    (("documentKind"::text = 'PDF' AND "declaredMediaType" = 'application/pdf') OR
     ("documentKind"::text = 'DOC' AND "declaredMediaType" = 'application/msword') OR
     ("documentKind"::text = 'DOCX' AND "declaredMediaType" = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  );
