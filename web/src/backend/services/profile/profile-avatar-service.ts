import "server-only";

import { prisma } from "@/backend/database/prisma";

const MAX_AVATAR_BYTES = 800 * 1024;

export class ProfileAvatarValidationError extends Error {}

function isPng(bytes: Buffer) {
  return (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

function isJpeg(bytes: Buffer) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  );
}

function validateAvatar(image: string) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(
    image,
  );
  if (!match) throw new ProfileAvatarValidationError("INVALID_AVATAR");

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
    throw new ProfileAvatarValidationError("INVALID_AVATAR_SIZE");
  }
  if (
    (match[1] === "png" && !isPng(bytes)) ||
    (match[1] === "jpeg" && !isJpeg(bytes))
  ) {
    throw new ProfileAvatarValidationError("INVALID_AVATAR_CONTENT");
  }
}

export class ProfileAvatarService {
  async save(userId: string, image: string) {
    validateAvatar(image);
    await prisma.userAccount.update({
      where: { id: userId },
      data: { image },
      select: { id: true },
    });
    return { image, message: "Profile photo saved." };
  }

  async remove(userId: string) {
    await prisma.userAccount.update({
      where: { id: userId },
      data: { image: null },
      select: { id: true },
    });
    return { image: null, message: "Profile photo removed." };
  }
}
