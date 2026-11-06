import Constants from "expo-constants";

/**
 * Public settings, built into the app from EXPO_PUBLIC_* variables (mobile/.env
 * locally, EAS environment variables for store builds). Nothing secret lives
 * in the app: the Supabase publishable key is designed to be public.
 */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || "https://casepingo.com").replace(/\/$/, ""),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  easProjectId: (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) || undefined,
  siteUrl: "https://casepingo.com",
};
