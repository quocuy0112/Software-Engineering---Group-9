import { beforeEach, describe, expect, it, vi } from "vitest";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/backend/database/prisma", () => ({
  prisma: { userAccount: { update } },
}));

import {
  ProfileAvatarService,
  ProfileAvatarValidationError,
} from "@/backend/services/profile/profile-avatar-service";

const png = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64")}`;

describe("ProfileAvatarService", () => {
  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({ id: "user-1" });
  });

  it("stores a validated raster avatar on the account", async () => {
    await expect(
      new ProfileAvatarService().save("user-1", png),
    ).resolves.toEqual({
      image: png,
      message: "Profile photo saved.",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: png },
      select: { id: true },
    });
  });

  it("rejects mismatched content even when the data URL claims PNG", async () => {
    const disguised = `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`;
    await expect(
      new ProfileAvatarService().save("user-1", disguised),
    ).rejects.toBeInstanceOf(ProfileAvatarValidationError);
    expect(update).not.toHaveBeenCalled();
  });

  it("removes the stored avatar", async () => {
    await expect(new ProfileAvatarService().remove("user-1")).resolves.toEqual({
      image: null,
      message: "Profile photo removed.",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: null },
      select: { id: true },
    });
  });
});
