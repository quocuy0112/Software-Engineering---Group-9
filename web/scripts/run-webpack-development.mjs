process.env.NEXT_DEV_BUNDLER = "webpack";

const { start } = await import("../server.ts");
await start();
