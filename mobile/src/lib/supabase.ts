import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { config } from "./config";
import { sessionStorage } from "./secure-storage";

export const supabase = createClient(config.supabaseUrl || "https://invalid.local", config.supabaseKey || "missing", {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground (Supabase's guidance for React Native).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
