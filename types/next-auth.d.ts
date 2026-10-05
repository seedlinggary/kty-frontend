import type { AdminRole } from "@/lib/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role?: AdminRole;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: AdminRole;
    };
  }
}

