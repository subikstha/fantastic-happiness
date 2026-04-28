"""
This is the OAuth client setup file for the API.
"""

from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)
oauth.register(
    name="github",
    client_id=settings.GITHUB_CLIENT_ID,
    client_secret=settings.GITHUB_CLIENT_SECRET,
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)


"""
Creates one Authlib OAuth() instance (oauth = OAuth()).
Registers two providers (google, github) with credentials from your app settings.
Makes those named providers available elsewhere via:
oauth.create_client("google")
oauth.create_client("github")
That’s what your auth endpoints will use for:

redirecting user to provider (authorize_redirect)
exchanging callback code for tokens (authorize_access_token)
fetching profile/user info
Provider-specific setup explained
Google registration
Uses server_metadata_url (OIDC discovery endpoint).
This is nice because Authlib auto-discovers authorize/token/userinfo endpoints.
Scope:
openid email profile gives subject id, email, basic profile.
GitHub registration
Uses explicit endpoints (authorize_url, access_token_url, api_base_url).
Scope user:email is needed to access email data (often private otherwise).
Why this file is useful
Keeps provider config out of route handlers.
One place to manage client ids/secrets/scopes.
Easy to add more providers (e.g. Discord) by one more oauth.register(...).
What to watch for
Ensure these settings exist in app/core/config.py and .env:
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
Callback URLs must match exactly what you configured in Google/GitHub developer console.
oauth = OAuth() is fine for now; if you later need session/state storage customization, you may wire it with framework config/middleware.
If you want, I can also explain how this connects line-by-line to your auth.py start/callback endpoints next.
"""