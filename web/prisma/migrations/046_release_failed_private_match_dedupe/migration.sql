-- A failed automatic attempt remains visible for history, but it must not
-- reserve the create-dedupe slot forever. Existing failed checks predate the
-- repository fix that releases this slot when marking a new failure.

UPDATE "PrivateCvMatchCheck"
   SET "creationDedupeKey" = NULL
 WHERE "state" = 'FAILED'
   AND "inaccessibleAt" IS NULL
   AND "deletedAt" IS NULL
   AND "creationDedupeKey" IS NOT NULL;
