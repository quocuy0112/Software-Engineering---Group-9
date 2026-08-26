// Node's Windows runtime can expose an unavailable os.userInfo() call in
// restricted environments. tsx uses that value only to choose its temporary
// directory, so provide a stable username before tsx is loaded.
import os from "node:os";

if (typeof process.geteuid !== "function") {
  os.userInfo = () => ({ username: "smarthire" });
}
