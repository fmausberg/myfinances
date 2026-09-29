import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { emailVerificationTimestamp } from "@/lib/email-verification-timestamp";

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
}
if (!process.env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL is required");

// PostgreSQL assigns the sequence value. Never supply a default or accept it
// from clients; it is separate from the string primary/foreign keys.
const numberField = {
  type: "number",
  required: false,
  input: false,
  unique: true,
} as const;

export const auth = betterAuth({
  appName: "My Finances",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Let Prisma apply @default(cuid()) for all authentication models.
  advanced: { database: { generateId: false } },
  plugins: [emailVerificationTimestamp],
  user: {
    additionalFields: {
      number: numberField,
      role: {
        type: ["USER", "ADMIN"],
        required: false,
        defaultValue: "USER",
        input: false,
      },
    },
  },
  account: { additionalFields: { number: numberField } },
  verification: { additionalFields: { number: numberField } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 1,
    maxPasswordLength: Infinity,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    additionalFields: { number: numberField },
  },
  rateLimit: {
    // RateLimit has no additionalFields API. Its number remains managed by
    // PostgreSQL and is available through Prisma, not the auth API.
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
