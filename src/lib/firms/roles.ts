import type { FirmRole } from "@prisma/client";

/** Display names for firm roles. Plain module so both server and client components can use it. */
export const ROLE_LABELS: Record<FirmRole, string> = { OWNER: "Owner", ADMIN: "Admin", STAFF: "Staff" };
