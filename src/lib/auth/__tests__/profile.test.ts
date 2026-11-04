import { describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { ensureProfile, isAdminEmail, ProfileConflictError } from "../profile";

function fakeDb(rows: User[] = []) {
  const user = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
      rows.find((r) => (where.id ? r.id === where.id : r.email === where.email)) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Partial<User> }) => {
      const row = { createdAt: new Date(), updatedAt: new Date(), name: null, locale: "en", ...data } as User;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    }),
  };
  return { db: { user } as never, user, rows };
}

const row = (id: string, email: string): User =>
  ({ id, email, name: null, locale: "en", createdAt: new Date(), updatedAt: new Date() }) as User;

describe("ensureProfile", () => {
  it("creates a profile on first sign-in from the JWT claims", async () => {
    const { db, user } = fakeDb();
    const u = await ensureProfile(db, { sub: "u1", email: "Ana@Example.com", user_metadata: { name: " Ana ", locale: "es" } });
    expect(u).toMatchObject({ id: "u1", email: "ana@example.com", name: "Ana", locale: "es" });
    expect(user.create).toHaveBeenCalledOnce();
  });

  it("ignores unsupported locales", async () => {
    const { db } = fakeDb();
    expect((await ensureProfile(db, { sub: "u1", email: "a@b.co", user_metadata: { locale: "fr" } })).locale).toBe("en");
  });

  it("only reads when the profile exists and is current", async () => {
    const { db, user } = fakeDb([row("u1", "a@b.co")]);
    await ensureProfile(db, { sub: "u1", email: "a@b.co" });
    expect(user.create).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("syncs a changed email", async () => {
    const { db, user } = fakeDb([row("u1", "old@b.co")]);
    expect((await ensureProfile(db, { sub: "u1", email: "new@b.co" })).email).toBe("new@b.co");
    expect(user.update).toHaveBeenCalledOnce();
  });

  it("refuses to attach an email owned by another account", async () => {
    const { db } = fakeDb([row("someone-else", "a@b.co")]);
    await expect(ensureProfile(db, { sub: "u1", email: "a@b.co" })).rejects.toBeInstanceOf(ProfileConflictError);
  });

  it("requires an email", async () => {
    const { db } = fakeDb();
    await expect(ensureProfile(db, { sub: "u1" })).rejects.toThrow(/email/);
  });
});

describe("isAdminEmail", () => {
  it("matches ADMIN_EMAILS case-insensitively", () => {
    const env = { ADMIN_EMAILS: " Boss@ICT.dev , other@ict.dev" };
    expect(isAdminEmail("boss@ict.dev", env)).toBe(true);
    expect(isAdminEmail("nobody@ict.dev", env)).toBe(false);
    expect(isAdminEmail("boss@ict.dev", {})).toBe(false);
  });
});
