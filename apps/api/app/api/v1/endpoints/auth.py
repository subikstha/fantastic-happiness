from fastapi import APIRouter, Depends, Response, status, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, AuthResponse, RefreshTokenRequest, AuthUser
from app.application.services.auth_service import AuthService
from app.api.deps.auth import get_current_user
from app.core.oauth import oauth
from app.application.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(email=payload.email, password=payload.password, db=db)

@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.sign_up_with_credentials(email=payload.email, password=payload.password, name=payload.name, username=payload.username, db=db)

@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh(refresh_token=payload.refresh_token, db=db)

@router.get("/me", response_model=AuthUser)
async def me(current_user = Depends(get_current_user)):
    return current_user

@router.post("/logout", status_code=204)
async def logout(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    await AuthService.logout(refresh_token=payload.refresh_token, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, request: Request):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid provider")
    client = oauth.create_client(provider)
    redirect_uri = str(request.url_for("oauth_callback", provider=provider))
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/oauth/{provider}/callback", name="oauth_callback", response_model=AuthResponse)
async def oauth_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    if provider == "google":
        profile = token.get("userinfo") or await client.userinfo(token=token)
        provider_account_id = profile["sub"]
        email = profile.get("email")
        name = profile.get("name") or email
        image = profile.get("picture")
        username = (email or provider_account_id).split("@")[0]
    else:
        resp = await client.get("user", token=token)
        gh = resp.json()
        provider_account_id = str(gh["id"])
        email = gh.get("email")  # may be None
        name = gh.get("name") or gh.get("login") or provider_account_id
        image = gh.get("avatar_url")
        username = gh.get("login") or provider_account_id
    return await AuthService.oauth_sign_in(
        provider=provider,
        provider_account_id=provider_account_id,
        email=email,
        name=name,
        image=image,
        username=username,
        db=db,
    )