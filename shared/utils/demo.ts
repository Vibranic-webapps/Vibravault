/**
 * The server's answer when the shared demo account tries something that's
 * locked for it (403). Shared so the app can recognise exactly this refusal
 * (and say it in the app's language) without a second copy of the text.
 */
export const DEMO_REFUSAL = "The demo account can't change this"
