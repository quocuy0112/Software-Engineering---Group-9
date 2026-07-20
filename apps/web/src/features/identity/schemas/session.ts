import { z } from "zod";
export const sessionReferenceSchema=z.string().uuid();
export const publicSessionSchema=z.object({reference:sessionReferenceSchema,current:z.boolean(),device:z.string().max(100),lastActiveAt:z.string().datetime(),expiresAt:z.string().datetime(),approximateLocation:z.string().max(80)}).strict();
export const publicSessionsSchema=z.array(publicSessionSchema);
export type PublicSession=z.infer<typeof publicSessionSchema>;
