import "server-only";
import { prisma } from "@/lib/db";
import { getFileStore } from "@/lib/storage/file-store";
import { getSystemStatus } from "./system-status";

/** The status of this deployment, with its real database and settings. */
export function liveSystemStatus() {
  return getSystemStatus({
    db: prisma,
    config: {
      storage: getFileStore() !== null,
      email: Boolean(process.env.SMTP_HOST),
      jobs: Boolean(process.env.INNGEST_SIGNING_KEY) || process.env.NODE_ENV !== "production",
    },
  });
}
