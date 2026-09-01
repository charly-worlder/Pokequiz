import { z } from 'zod'

// spec.md AC-1, AC-2, EC-5: 3–20 characters, letters/digits/underscore only.
export const trainerNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Trainername: 3–20 Zeichen, nur Buchstaben, Zahlen und _')

export const emailSchema = z.string().trim().email('Bitte eine gültige E-Mail-Adresse eingeben')

// spec.md AC-1, AC-11: minimum 8 characters, no forced character classes.
export const passwordSchema = z.string().min(8, 'Mindestens 8 Zeichen')

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
