import { z } from 'zod'

// spec.md AC-1, AC-2, EC-5: 3–20 characters, letters/digits/underscore only.
export const trainerNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Trainername: 3–20 Zeichen, nur Buchstaben, Zahlen und _')

export const emailSchema = z.string().trim().email('Bitte eine gültige E-Mail-Adresse eingeben')

// spec.md AC-1, AC-11: minimum 8 characters, no forced character classes.
//
// The upper bound is bcrypt's, not ours: Supabase rejects anything over 72
// bytes with a 400. Until this was checked here, such a password produced "Die
// Verbindung ist fehlgeschlagen" — an error about the network for a problem
// with the field, and no hint what to change (BUG-11). Password managers
// generate passphrases this long, so it is not a hypothetical input.
//
// Measured in bytes, because that is what the limit counts: "ä" is two, most
// emoji are four. A character count would let a 72-character passphrase full of
// umlauts through and hand the same confusing error back.
const PASSWORD_MAX_BYTES = 72

export const passwordSchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen')
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
    message: 'Höchstens 72 Zeichen (Umlaute und Emoji zählen mehrfach)',
  })

export const registerSchema = z.object({
  trainerName: trainerNameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passwort eingeben'),
})

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
})

export const updatePasswordSchema = z.object({
  password: passwordSchema,
})
