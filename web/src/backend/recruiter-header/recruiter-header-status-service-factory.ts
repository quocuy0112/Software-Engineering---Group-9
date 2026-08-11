import "server-only";

import { PrismaRecruiterHeaderStatusRepository } from "@/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository";
import { RecruiterHeaderStatusService } from "./recruiter-header-status-service";

export function getRecruiterHeaderStatusService() {
  return new RecruiterHeaderStatusService(
    new PrismaRecruiterHeaderStatusRepository(),
  );
}
