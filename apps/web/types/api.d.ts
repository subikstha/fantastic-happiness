type FastApiAuthResponse = {
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    username?: string | null;
  };
};
