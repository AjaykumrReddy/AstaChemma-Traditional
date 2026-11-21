import { useGameStore } from '../store/game';
import { STRINGS, type Strings } from './strings';

export { STRINGS, displayName, isDefaultYou, withDisplayNames, type Lang, type RulesSection, type Strings } from './strings';

/** The text for the player's chosen language. */
export function useStrings(): Strings {
  return STRINGS[useGameStore((s) => s.language)];
}
