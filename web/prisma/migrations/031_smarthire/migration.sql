-- Compatibility migration retained for databases that recorded the merged
-- branch migration under this stable name.
--
-- The original generated SQL replayed the proposal, support, and messaging
-- objects already created by migrations 025, 026, 029, and 030. That made a
-- fresh deploy fail on duplicate enum/table/index objects. The authoritative
-- schema is already complete before 031, so this history entry is intentionally
-- a no-op for new databases and remains safe for databases that already ran the
-- previous equivalent migration.
SELECT 1;
