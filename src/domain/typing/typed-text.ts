/** The characters the romanization engine can consume as typed input. */
export const TYPABLE_CHARACTER = /^[a-z0-9 ' -]$/i;

export type NormalizedTypedText = {
  /** Lower-cased characters the engine can consume, in input order. */
  keys: string;
  /** Characters that were dropped because the engine cannot consume them. */
  rejected: string;
};

/**
 * Split raw input into engine-consumable keys and rejected characters.
 *
 * Software keyboards deliver whatever mode the user left them in, so a Japanese
 * keyboard produces kana that the romanization engine cannot score. Rejecting
 * silently makes the app look broken, so the rejected characters are returned
 * for the caller to surface as guidance rather than as typing mistakes.
 */
export function normalizeTypedText(raw: string): NormalizedTypedText {
  let keys = "";
  let rejected = "";
  for (const character of raw) {
    if (TYPABLE_CHARACTER.test(character)) keys += character.toLowerCase();
    else rejected += character;
  }
  return { keys, rejected };
}
