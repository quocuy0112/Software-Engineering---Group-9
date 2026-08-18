// TSX derives a temporary directory from process.geteuid() when available.
// Supplying the harmless test-process UID avoids Node's failing os.userInfo()
// lookup on constrained Windows E2E hosts before any fixture code executes.
if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", { value: () => 0 });
}
