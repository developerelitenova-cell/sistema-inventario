import re
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
import hashlib

import models, schemas
from database import get_db
from services import auth as auth_service, audit
from supabase_client import upload_base64_image

router = APIRouter(prefix="/auth", tags=["Autenticación"])

def _slugify_username(name: str) -> str:
    import re, unicodedata
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", ".", normalized).strip(".").lower()
    return slug or "usuario"


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Formato de correo electrónico inválido")
    domain = email.split("@")[-1]
    allowed_domains = [
        "elitenutrition.com.co",
        "elitenovagroup.com",
        "futupro.com",
        "futupro.com.co",
        "futupro.co",
        "example.com",
    ]
    if domain not in allowed_domains and not any(domain.endswith("." + d) for d in allowed_domains):
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten correos corporativos oficiales (@elitenutrition.com.co, @futupro.com, @elitenovagroup.com)"
        )

    user = db.query(models.User).filter(
        models.User.document_id == payload.document_id,
        models.User.password_hash.is_(None),
    ).first()

    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email and (not user or existing_email.id != user.id):
        raise HTTPException(status_code=400, detail="Ese correo ya tiene una cuenta")

    photo_url = payload.photo_url
    if photo_url and photo_url.startswith("data:image"):
        uploaded = upload_base64_image(photo_url, "inventory-assets", "users/photos", f"{payload.document_id}_photo")
        if uploaded:
            photo_url = uploaded

    signature_url = payload.digital_signature_url
    if signature_url and signature_url.startswith("data:image"):
        uploaded = upload_base64_image(signature_url, "inventory-assets", "users/signatures", f"{payload.document_id}_sig", is_private=True)
        if uploaded:
            signature_url = uploaded

    generated_password = auth_service.generate_password()
    password_hash = auth_service.hash_password(generated_password)

    # Función auxiliar para resolver la bodega por clave o alias
    def _find_warehouse(key: str) -> Optional[models.Warehouse]:
        wh = db.query(models.Warehouse).filter(models.Warehouse.key == key).first()
        if not wh:
            if "futu" in key.lower():
                wh = db.query(models.Warehouse).filter(models.Warehouse.key.ilike("%futu%")).first()
            elif "elite" in key.lower():
                wh = db.query(models.Warehouse).filter(models.Warehouse.key.ilike("%elite%")).first()
        return wh

    # Fallback inteligente si no seleccionaron bodega explícita pero el correo indica la empresa
    eff_warehouse_key = payload.warehouse_key
    if not eff_warehouse_key:
        if "futupro" in email:
            eff_warehouse_key = "futupro"
        elif "elite" in email:
            eff_warehouse_key = "elite_nutricion"

    target_wh = _find_warehouse(eff_warehouse_key) if eff_warehouse_key else None

    if user:
        user.full_name = payload.full_name
        user.email = payload.email
        user.photo_url = photo_url or user.photo_url
        user.digital_signature_url = signature_url or user.digital_signature_url
        user.password_hash = password_hash
        if payload.cargo:
            user.cargo = payload.cargo.strip()
        if payload.role and payload.role != models.RoleEnum.ADMIN:
            user.role = payload.role
        if target_wh and not user.warehouses:
            user.warehouses.append(target_wh)
    else:
        base_username = _slugify_username(payload.full_name)
        username = base_username
        suffix = 1
        while db.query(models.User).filter(models.User.username == username).first():
            suffix += 1
            username = f"{base_username}.{suffix}"

        db_doc = db.query(models.User).filter(models.User.document_id == payload.document_id).first()
        if db_doc:
            raise HTTPException(status_code=400, detail="Ese documento ya tiene una cuenta registrada")

        user_role = payload.role or models.RoleEnum.EMPLEADO
        if user_role == models.RoleEnum.ADMIN:
            # El rol admin no se puede autorrecetar por registro público
            user_role = models.RoleEnum.EMPLEADO

        user = models.User(
            username=username,
            full_name=payload.full_name,
            document_id=payload.document_id,
            email=payload.email,
            photo_url=photo_url,
            digital_signature_url=signature_url,
            role=user_role,
            cargo=payload.cargo.strip() if payload.cargo else None,
            password_hash=password_hash,
        )
        
        if target_wh:
            user.warehouses.append(target_wh)
                
        db.add(user)

    db.commit()
    db.refresh(user)

    audit.log_action(db, user, "user.registered", f"{user.full_name} se registró en el sistema", entity_type="user", entity_id=user.id)
    db.commit()

    token = auth_service.create_token(db, user)
    return schemas.AuthResponse(token=token, user=user, generated_password=generated_password)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not user.password_hash or not auth_service.verify_password(payload.password, user.password_hash):
        audit.log_action(
            db, user, "auth.login_failed", f"Intento de login fallido para {payload.email}",
            entity_type="user", entity_id=user.id if user else None,
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    if user.is_active is False:
        audit.log_action(
            db, user, "auth.login_blocked_inactive", f"Intento de login bloqueado para usuario inactivo {payload.email}",
            entity_type="user", entity_id=user.id,
        )
        db.commit()
        raise HTTPException(status_code=403, detail="Tu usuario se encuentra deshabilitado. Comunícate con el Administrador.")

    token = auth_service.create_token(db, user)
    audit.log_action(db, user, "auth.login", f"{user.full_name} inició sesión", entity_type="user", entity_id=user.id)
    db.commit()
    return schemas.AuthResponse(token=token, user=user)


@router.get("/me", response_model=schemas.User)
def get_me(current_user: models.User = Depends(auth_service.get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.password_hash or not auth_service.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")

    if not re.search(r"[A-Za-z]", payload.new_password) or not re.search(r"[0-9!@#$%^&*(),.?\":{}|<>]", payload.new_password):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe incluir al menos una letra y un número o símbolo especial")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la actual")

    current_user.password_hash = auth_service.hash_password(payload.new_password)
    audit.log_action(db, current_user, "auth.password_changed", f"{current_user.full_name} cambió su contraseña", entity_type="user", entity_id=current_user.id)
    db.commit()
    return {"message": "Contraseña actualizada exitosamente"}


@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(default=None),
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        hashed_token = hashlib.sha256(token.encode()).hexdigest()
        db.query(models.AuthToken).filter(models.AuthToken.token == hashed_token).delete()
        audit.log_action(db, current_user, "auth.logout", f"{current_user.full_name} cerró sesión", entity_type="user", entity_id=current_user.id)
        db.commit()
    return {"message": "Sesión cerrada exitosamente"}
