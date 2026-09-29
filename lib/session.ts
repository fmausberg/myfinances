import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Application code uses the persisted timestamp, not Better Auth's boolean.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      number: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;
  return { ...session, user };
}
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
