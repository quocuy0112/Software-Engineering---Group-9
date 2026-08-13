import { beforeEach, describe, expect, it, vi } from "vitest";
import { REALTIME_SOCKET_PATH } from "@/shared/contracts/realtime/socket-transport";

const socket = {
  disconnect: vi.fn(),
};
const io = vi.fn(() => socket);

vi.mock("socket.io-client", () => ({ io }));

describe("support socket transport", () => {
  beforeEach(async () => {
    io.mockClear();
    socket.disconnect.mockClear();
    const { disconnectSupportSocket } =
      await import("@/frontend/features/support/client/support-socket");
    disconnectSupportSocket();
  });

  it("uses the same transport path as the custom Socket.IO server", async () => {
    const { getSupportSocket } =
      await import("@/frontend/features/support/client/support-socket");

    getSupportSocket();

    expect(REALTIME_SOCKET_PATH).toBe("/chat");
    expect(io).toHaveBeenCalledWith(
      "/support",
      expect.objectContaining({ path: REALTIME_SOCKET_PATH }),
    );
  });
});
