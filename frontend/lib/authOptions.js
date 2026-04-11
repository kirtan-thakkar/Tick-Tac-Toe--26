import CredentialsProvider from "next-auth/providers/credentials";
import { verifyOTP } from "./otpStore";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) {
          return null;
        }

        const isValid = verifyOTP(credentials.email, credentials.code);
        
        if (isValid) {
          return { id: credentials.email, email: credentials.email, name: credentials.email.split("@")[0] };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
};