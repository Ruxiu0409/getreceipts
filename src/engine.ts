import { extractClaims } from "./claim-extractor";
import { match } from "./matcher";
import type { Facts, Finding, TurnData } from "./types";

/**
 * The whole verification pipeline for one turn: pull falsifiable claims out of
 * the assistant's prose, then keep only the ones the observed facts disprove.
 */
export function analyzeTurn(turn: TurnData, facts: Facts): Finding[] {
  return match(extractClaims(turn.assistantText), facts);
}
