import "server-only";
import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { getPushDriver } from "@/lib/push";
import { createBulletinApi } from "./api";
import { createVisaBulletinService } from "./service";

export const visaBulletinService = () =>
  createVisaBulletinService({
    db: prisma,
    mailer: getEmailDriver(),
    pusher: getPushDriver(),
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://casepingo.com").replace(/\/$/, ""),
  });

export const bulletinApi = () => createBulletinApi({ db: prisma, svc: visaBulletinService() });
