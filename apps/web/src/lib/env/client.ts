import { z } from "zod";

const clientSchema = z.object({ NEXT_PUBLIC_APP_URL: z.string().url() });
export const clientEnvironment = clientSchema.parse({ NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL });
