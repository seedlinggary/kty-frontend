import { customAlphabet } from "nanoid";

// Excludes visually ambiguous characters (0/O, 1/I) since staff may read this back over the phone.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const generateBillId = customAlphabet(ALPHABET, 7);
