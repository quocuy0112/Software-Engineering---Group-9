ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "entityType" TEXT;

WITH normalized AS (
  SELECT
    "id",
    CASE
      WHEN "legalName" ~* '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$'
        THEN btrim(regexp_replace(
          "legalName",
          '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$',
          '',
          'i'
        ))
      ELSE "legalName"
    END AS "legalName",
    CASE
      WHEN "displayName" ~* '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$'
        THEN btrim(regexp_replace(
          "displayName",
          '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$',
          '',
          'i'
        ))
      ELSE "displayName"
    END AS "displayName",
    COALESCE(
      "entityType",
      NULLIF(
        btrim((regexp_match(
          CASE
            WHEN "displayName" ~* '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$'
              THEN "displayName"
            ELSE "legalName"
          END,
          '[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*([^()]+?)[)][[:space:]]*$',
          'i'
        ))[1]),
        ''
      ),
      "entityType"
    ) AS "entityType"
  FROM "Company"
  WHERE
    "legalName" ~* '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$'
    OR "displayName" ~* '[[:space:]]*[(][[:space:]]*loại[[:space:]]+hình[[:space:]]+doanh[[:space:]]+nghiệp[[:space:]]*:[[:space:]]*[^()]+[)][[:space:]]*$'
)
UPDATE "Company" AS company
SET
  "legalName" = normalized."legalName",
  "displayName" = normalized."displayName",
  "entityType" = normalized."entityType"
FROM normalized
WHERE company."id" = normalized."id";
