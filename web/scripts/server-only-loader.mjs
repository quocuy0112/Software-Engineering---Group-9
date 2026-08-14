const emptyServerOnlyModule = new URL(
  "./server-only-shim.cjs",
  import.meta.url,
).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: emptyServerOnlyModule, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
