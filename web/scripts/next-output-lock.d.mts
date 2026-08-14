export function acquireNextOutputLock(
  owner: string,
  lockPath?: string,
): Promise<() => Promise<void>>;
