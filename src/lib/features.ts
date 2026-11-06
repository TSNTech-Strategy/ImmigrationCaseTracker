/**
 * Features that are built but switched off for now. Flip a flag here to turn one
 * back on, and the same flag in mobile/src/lib/features.ts for the app.
 */
export const FEATURES: Readonly<{ assistant: boolean }> = {
  /**
   * The AI assistant (website page, API, header link, case-page link, privacy
   * paragraphs). Off for now: its code, tests and database table stay, so turning
   * it back on is this flag plus ANTHROPIC_API_KEY in Vercel.
   */
  assistant: false,
};
