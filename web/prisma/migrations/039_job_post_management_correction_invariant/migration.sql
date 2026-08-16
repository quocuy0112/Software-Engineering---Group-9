-- One live correction request per managed job prevents concurrent moderators
-- from creating ambiguous recruiter instructions.
CREATE UNIQUE INDEX "JobPostRevisionRequest_one_open_per_aggregate"
  ON "JobPostRevisionRequest" ("aggregateId")
  WHERE "state" = 'OPEN';
