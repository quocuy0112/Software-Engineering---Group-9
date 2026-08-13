import { registerHooks } from "node:module";
import { resolve } from "./server-only-loader.mjs";

registerHooks({ resolve });
