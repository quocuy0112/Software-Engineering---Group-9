if (typeof process.geteuid !== "function") process.geteuid = () => 0;
require("dotenv").config({ path: ".env", override: false });
require("dotenv").config({ path: ".env.local", override: true });
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
