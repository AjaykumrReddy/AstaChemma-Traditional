import { CODE_ALPHABET, CODE_LENGTH } from '@asta/protocol';

/** The rooms namespace, as far as picking a code needs it. */
interface RoomsNamespace {
  getByName(name: string): { exists(): Promise<boolean> };
}

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/**
 * A room code that isn't in use. With 32^4 codes and short-lived rooms a clash
 * is rare; a few tries is plenty. Null if every try was taken.
 */
export async function freshCode(rooms: RoomsNamespace): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    if (!(await rooms.getByName(code).exists())) return code;
  }
  return null;
}
