from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, get_current_user, require_roles
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.models.role import Role
from app.schemas.auth import TokenResponse, UserCreateRequest, UserResponse

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == form_data.username).options(selectinload(User.role))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(str(user.id), user.role.name)
    return TokenResponse(access_token=access_token)

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role.name,
        is_active=current_user.is_active
    )

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    current_user: User = require_roles("fleet_manager"),
    db: AsyncSession = Depends(get_db)
):
    # Lookup role
    role_stmt = select(Role).where(Role.name == request.role)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
        
    # Check if email exists
    email_stmt = select(User).where(User.email == request.email)
    email_result = await db.execute(email_stmt)
    existing_user = email_result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )
        
    # Create new user
    new_user = User(
        full_name=request.full_name,
        email=request.email,
        hashed_password=hash_password(request.password),
        role_id=role.id,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Reload with role to construct response
    stmt = select(User).where(User.id == new_user.id).options(selectinload(User.role))
    result = await db.execute(stmt)
    new_user_loaded = result.scalar_one()
    
    return UserResponse(
        id=new_user_loaded.id,
        full_name=new_user_loaded.full_name,
        email=new_user_loaded.email,
        role=new_user_loaded.role.name,
        is_active=new_user_loaded.is_active
    )
