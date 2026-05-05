import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

import { IAccountDoc } from './database/account.model';
import { api } from './lib/api';
import { SignInSchema } from './lib/validations';

async function refreshAccessToken(token: any) {
  try {
    if (!token.refreshToken) {
      return { ...token, error: 'MissingRefreshToken' };
    }
    // Example direct call; adapt to your api helper if you add api.auth.refresh(...)
    const res = await fetch(`${process.env.FASTAPI_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });
    if (!res.ok) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }
    const data = await res.json(); // FastAPI AuthResponse shape
    return {
      ...token,
      accessToken: data.tokens.access_token,
      refreshToken: data.tokens.refresh_token ?? token.refreshToken, // rotation-safe
      accessTokenExpiresAt: Date.now() + data.tokens.expires_in * 1000,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

// We will check if the sign-in account type is credentials; if yes, then we skip. We'll handle it the other way around when doing email password based authentication

// But if the account type is not credentials, then we'll call this new `signin-with-oauth` route and create oAuth accounts.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
    Credentials({
      async authorize(credentials) {
        const validatedFields = SignInSchema.safeParse(credentials);
        if (validatedFields.success) {
          const { email, password } = validatedFields.data;
          const loginResponse = await api.auth.login(email, password);
          if (loginResponse.success && loginResponse.data) {
            const { user, tokens } = loginResponse.data;
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image ?? undefined,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              accessTokenExpiresAt: tokens.expires_in,
            };
          }
        }
        return null;
      },
    }),
  ],
  // It is the callback decides what is going to happen after a user signs in using oAuth or credentials allowing us to do
  // some further verifications or if the auth flow should be stopped
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.accessToken = token.accessToken as string;
      session.user.accessTokenExpiresAt = token.accessTokenExpiresAt as number;
      // session.user.refreshToken = token.refreshToken as string;
      // session.user.accessTokenExpires = token.accessTokenExpires as number;
      // session.token = token;
      return session;
    },
    async jwt({ token, account, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.accessToken = user.accessToken as string;
        token.refreshToken = user.refreshToken as string;
        token.accessTokenExpires = user.accessTokenExpiresAt as number;
        return token;
      }

      // If still valid, reuse token
      if (
        typeof token.accessTokenExpiresAt === 'number' &&
        Date.now() < token.accessTokenExpiresAt
      ) {
        return token;
      }

      if (account && account.type !== 'credentials') {
        const { data: existingAccount, success } =
          (await api.accounts.getByProvider(
            account.providerAccountId
          )) as ActionResponse<IAccountDoc>;

        if (!success || !existingAccount) return token;

        const userId = existingAccount.userId;

        if (userId) token.sub = userId.toString();
      }

      // console.log('token and accounts are', token, account?.access_token);
      return refreshAccessToken(token);
    },
    async signIn({ user, profile, account }) {
      if (account?.type === 'credentials') {
        return true;
      }
      if (!account || !user) {
        return false;
      }

      const userInfo = {
        name: user.name!,
        email: user.email!,
        image: user.image!,
        username:
          account.provider === 'github'
            ? (profile?.login as string)
            : (user.name?.toLowerCase() as string),
      };

      const { success } = (await api.auth.oAuthSignIn({
        user: userInfo,
        provider: account.provider as 'github' | 'google',
        providerAccountId: account.providerAccountId as string,
      })) as ActionResponse;

      if (!success) return false;
      return true;
    },
  },
});
