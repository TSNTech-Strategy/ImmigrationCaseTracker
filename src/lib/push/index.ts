/**
 * Push alerts through Expo's push service (free; it relays to Apple and
 * Google). Same shape as the email drivers: "console" in development,
 * "expo" in production. EXPO_ACCESS_TOKEN (optional, server-only) turns on
 * Expo's enhanced push security.
 */

export type PushMessage = { to: string; title: string; body: string; data?: Record<string, string> };
/** Per message, in order: ok, the token is dead (remove it), or another error. */
export type PushResult = { status: "ok" } | { status: "dead" } | { status: "error"; message: string };
export type PushDriver = { name: "console" | "expo"; send(messages: PushMessage[]): Promise<PushResult[]> };

export const isExpoPushToken = (t: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(t);

export const consolePushDriver: PushDriver = {
  name: "console",
  async send(messages) {
    for (const m of messages) console.log(`[push] ${m.to.slice(0, 22)}… "${m.title}" — ${m.body}`);
    return messages.map(() => ({ status: "ok" as const }));
  },
};

type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

export function expoPushDriver({ accessToken, fetchImpl = fetch }: { accessToken?: string; fetchImpl?: typeof fetch } = {}): PushDriver {
  return {
    name: "expo",
    async send(messages) {
      const out: PushResult[] = [];
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const res = await fetchImpl("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: "default", priority: "high" }))),
        });
        if (!res.ok) throw new Error(`Expo push failed: HTTP ${res.status}`);
        const { data } = (await res.json()) as { data: ExpoTicket[] };
        for (const t of data) {
          if (t.status === "ok") out.push({ status: "ok" });
          else if (t.details?.error === "DeviceNotRegistered") out.push({ status: "dead" });
          else out.push({ status: "error", message: String(t.message ?? "push error").slice(0, 200) });
        }
      }
      return out;
    },
  };
}

export function getPushDriver(env: Record<string, string | undefined> = process.env): PushDriver {
  const choice = env.PUSH_DRIVER?.trim() || (env.VERCEL_ENV === "production" ? "expo" : "console");
  return choice === "expo" ? expoPushDriver({ accessToken: env.EXPO_ACCESS_TOKEN?.trim() || undefined }) : consolePushDriver;
}
