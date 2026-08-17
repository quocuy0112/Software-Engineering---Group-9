-- PostgreSQL folds unquoted PL/pgSQL record fields to lowercase. The
-- camel-cased currentAttemptId column therefore must be quoted in the
-- publication guard; otherwise every private-check insert fails before the
-- first queued attempt can be created.

CREATE OR REPLACE FUNCTION "enforce_private_current_attempt"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  attempt_check_id TEXT;
  attempt_state TEXT;
BEGIN
  IF NEW."currentAttemptId" IS NULL THEN
    IF NEW."state" IN ('READY', 'LIMITED') THEN
      RAISE EXCEPTION 'private check terminal state requires a current attempt';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "checkId", "state"::text
    INTO attempt_check_id, attempt_state
    FROM "PrivateCvMatchAttempt"
   WHERE "id" = NEW."currentAttemptId";

  IF attempt_check_id IS DISTINCT FROM NEW."id"
     OR attempt_state NOT IN ('READY', 'LIMITED') THEN
    RAISE EXCEPTION 'private current attempt must belong to its check and be publishable';
  END IF;
  IF NEW."state" = 'READY' AND attempt_state <> 'READY' THEN
    RAISE EXCEPTION 'ready private check requires a ready attempt';
  END IF;
  IF NEW."state" = 'LIMITED' AND attempt_state <> 'LIMITED' THEN
    RAISE EXCEPTION 'limited private check requires a limited attempt';
  END IF;
  RETURN NEW;
END;
$$;
