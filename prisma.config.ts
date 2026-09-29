import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Client generation also runs during installation, before .env may exist.
    url: process.env.DATABASE_URL ?? "",
  },
});
