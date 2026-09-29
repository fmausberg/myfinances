import "server-only";
import type { BetterAuthPlugin } from "better-auth";

// Better Auth's public contract uses a boolean; Prisma stores the timestamp.
// Keep this conversion at the database boundary, not in verification endpoints.
export const emailVerificationTimestamp = {
  id: "email-verification-timestamp",
  schema: {
    user: {
      fields: {
        emailVerified: {
          type: "boolean",
          fieldName: "emailVerifiedAt",
          required: false,
          defaultValue: false,
          input: false,
          transform: {
            input: (value) => {
              if (value === undefined) return undefined;
              if (value instanceof Date) return value;
              return value === true ? new Date() : null;
            },
            output: (value) => value != null,
          },
        },
      },
    },
  },
} satisfies BetterAuthPlugin;
