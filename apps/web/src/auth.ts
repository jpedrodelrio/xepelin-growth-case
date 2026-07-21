import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}

if (process.env.AUTH_DEMO_MODE === "true" || providers.length === 0) {
  providers.push(CredentialsProvider({
    name: "Demo",
    credentials: {},
    async authorize() {
      return { id: "demo-user", name: "Growth Reviewer", email: "reviewer@demo.xepelin.com" };
    },
  }));
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET ?? "development-only-secret-change-me",
};
