import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Me } from "./api";
import { deviceLang, strings, type Lang } from "./i18n";
import { unregisterPush } from "./push";
import { supabase } from "./supabase";

type AuthState = {
  ready: boolean;
  session: Session | null;
  /** Signed in with a password but the account needs its two-factor code first. */
  needsMfa: boolean;
  me: Me | null;
  lang: Lang;
  t: ReturnType<typeof strings>;
  refreshMe: () => Promise<Me | null>;
  setMe: (me: Me) => void;
  checkMfa: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const checkMfa = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const need = data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
    setNeedsMfa(need);
    return need;
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const m = await api<Me>("/api/v1/me");
      setMe(m);
      return m;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) {
        const need = await checkMfa();
        if (!need) await refreshMe();
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setMe(null);
        setNeedsMfa(false);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [checkMfa, refreshMe]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase.auth.signOut();
    setMe(null);
  }, []);

  const lang: Lang = me?.locale ?? deviceLang();
  const value = useMemo(
    () => ({ ready, session, needsMfa, me, lang, t: strings(lang), refreshMe, setMe, checkMfa, signOut }),
    [ready, session, needsMfa, me, lang, refreshMe, checkMfa, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
