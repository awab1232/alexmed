import type { User } from "../../drizzle/schema";
import { auth } from "../auth";

export type TrpcContext = {
  user: User | null;
};

export async function createContext(): Promise<TrpcContext> {
  const session = await auth();

  if (!session?.user) {
    return { user: null };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      role:
        (session.user as { role?: string }).role === "admin" ? "admin" : "user",
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    } as User,
  };
}
