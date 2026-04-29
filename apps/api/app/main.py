from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

from starlette.middleware.sessions import SessionMiddleware

app = FastAPI(title=settings.APP_NAME)

_cors_origins = [
    o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

#Register the SessionMiddleware
app.add_middleware(
    SessionMiddleware, 
    secret_key=settings.SESSION_SECRET, # typical for OAuth redirects; use "none" only if you need cross-site + Secure
    same_site="lax", # set True when the API is only served over HTTPS (staging/production)
    https_only=False
    )

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Hello, World!"}
