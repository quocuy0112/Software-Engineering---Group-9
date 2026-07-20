import "server-only";
import { parseServerEnvironment } from "./server";

export const serverEnvironment = parseServerEnvironment(process.env);
