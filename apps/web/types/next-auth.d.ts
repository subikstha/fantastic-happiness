import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      accessToken?: string;
      accessTokenExpiresAt?: number;
    } & DefaultSession['user'];
    error?: 'RefreshAccessTokenError' | 'MissingRefreshToken';
  }

  interface User extends DefaultUser {
    accessToken: string;
    refreshToken: string; // stays internal -> JWT only
    accessTokenExpiresAt: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: 'RefreshAccessTokenError' | 'MissingRefreshToken';
  }
}
