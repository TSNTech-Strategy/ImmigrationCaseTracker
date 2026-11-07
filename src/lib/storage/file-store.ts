import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Where uploaded files live. Production: a private Supabase Storage bucket (server key only).
 * Development and tests: a local folder. Files arrive here already encrypted by the caller.
 */
export interface FileStore {
  readonly name: "supabase" | "local";
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const BUCKET = "firm-documents";

export function createLocalFileStore(root: string): FileStore {
  const path = (key: string) => {
    const p = normalize(join(root, key));
    if (!p.startsWith(normalize(root))) throw new Error("Bad file key");
    return p;
  };
  return {
    name: "local",
    async put(key, data) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), data);
    },
    get: (key) => readFile(path(key)),
    remove: (key) => rm(path(key), { force: true }),
  };
}

function createSupabaseFileStore(): FileStore {
  const client = createSupabaseAdminClient();
  let bucketReady: Promise<void> | null = null;
  const ensureBucket = () =>
    (bucketReady ??= (async () => {
      const { data } = await client.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await client.storage.createBucket(BUCKET, { public: false });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Storage bucket: ${error.message}`);
    })().catch((err) => {
      bucketReady = null;
      throw err;
    }));
  return {
    name: "supabase",
    async put(key, data) {
      await ensureBucket();
      const { error } = await client.storage.from(BUCKET).upload(key, data, { contentType: "application/octet-stream", upsert: false });
      if (error) throw new Error(`Storage upload: ${error.message}`);
    },
    async get(key) {
      const { data, error } = await client.storage.from(BUCKET).download(key);
      if (error || !data) throw new Error(`Storage download: ${error?.message ?? "missing"}`);
      return Buffer.from(await data.arrayBuffer());
    },
    async remove(key) {
      const { error } = await client.storage.from(BUCKET).remove([key]);
      if (error) throw new Error(`Storage remove: ${error.message}`);
    },
  };
}

let cached: FileStore | null | undefined;

/** The file store for this deployment, or null when uploads aren't set up here (e.g. a preview without the server key). */
export function getFileStore(): FileStore | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasKey = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const isLocalSupabase = /localhost|127\.0\.0\.1/.test(url);
  if (hasKey && url && !isLocalSupabase) cached = createSupabaseFileStore();
  else if (process.env.FILE_STORE_DIR || process.env.NODE_ENV !== "production" || isLocalSupabase) cached = createLocalFileStore(process.env.FILE_STORE_DIR || join(tmpdir(), "casepingo-files"));
  else cached = null;
  return cached;
}
