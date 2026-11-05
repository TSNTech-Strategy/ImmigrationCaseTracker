/** Turn a Supabase Auth error into a message safe and useful to show users. */
export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  switch (err?.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link we sent.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "weak_password":
      return "That password is too weak. Use at least 10 characters with letters and numbers.";
    case "same_password":
      return "Choose a password different from your current one.";
    case "signup_disabled":
      return "New sign-ups are currently closed.";
    case "session_expired":
    case "session_not_found":
      return "Your session has expired. Please sign in again.";
  }
  if (err?.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  return "Something went wrong. Please try again.";
}
