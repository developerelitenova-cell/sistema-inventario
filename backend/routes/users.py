from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import auth as auth_service, audit
from supabase_client import upload_base64_image

router = APIRouter(tags=["Usuarios"])


def _resolve_warehouses(db: Session, keys: List[str]) -> List["models.Warehouse"]:
    if not keys:
        return []
    found = db.query(models.Warehouse).filter(models.Warehouse.key.in_(keys)).all()
    if len(found) != len(set(keys)):
        raise HTTPException(status_code=400, detail="Una o más bodegas seleccionadas no existen")
    return found


def _assert_scoped_admin_can_assign(admin: "models.User", role: "models.RoleEnum", warehouse_keys: List[str]) -> None:
    """Un admin acotado a su bodega no puede crear/promover a otro admin,
    ni otorgar acceso a bodegas fuera de su propio alcance."""
    is_admin = (
        admin.role == models.RoleEnum.ADMIN
        or (isinstance(admin.role, str) and admin.role.lower() == "admin")
        or auth_service.is_master_admin(admin)
    )
    if is_admin:
        return
    role_val = role.value if hasattr(role, "value") else str(role)
    if role_val == models.RoleEnum.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden asignar el rol Administrador")
    own_keys = set(auth_service.visible_warehouse_keys(admin) or [])
    if not set(warehouse_keys).issubset(own_keys):
        raise HTTPException(status_code=403, detail="No podés otorgar acceso a una bodega que vos mismo no administrás")


def validate_corporate_email(email: str = None) -> None:
    if not email:
        return
    email = email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Formato de correo electrónico inválido")


@router.post("/users/", response_model=schemas.User)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    validate_corporate_email(user.email)

    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username ya registrado")

    _assert_scoped_admin_can_assign(_admin, user.role, user.warehouse_keys)
    warehouses = _resolve_warehouses(db, user.warehouse_keys)

    # Si no se seleccionó bodega explícita, aplicar asignación inteligente por correo o ámbito del admin
    if not warehouses:
        if user.email and "futupro" in user.email.lower():
            futu_wh = db.query(models.Warehouse).filter(models.Warehouse.key == "futupro").first()
            if futu_wh:
                warehouses = [futu_wh]
        elif user.email and "elite" in user.email.lower():
            elite_wh = db.query(models.Warehouse).filter(models.Warehouse.key == "elite_nutricion").first()
            if elite_wh:
                warehouses = [elite_wh]
        elif not auth_service.is_master_admin(_admin):
            own_keys = auth_service.visible_warehouse_keys(_admin) or []
            if own_keys:
                warehouses = db.query(models.Warehouse).filter(models.Warehouse.key.in_(own_keys)).all()

    user_dict = user.dict(exclude={"warehouse_keys"})
    if user_dict.get("photo_url") and user_dict["photo_url"].startswith("data:image"):
        url = upload_base64_image(user_dict["photo_url"], "inventory-assets", "users/photos", f"{user.username}_photo")
        if url:
            user_dict["photo_url"] = url

    if user_dict.get("digital_signature_url") and user_dict["digital_signature_url"].startswith("data:image"):
        url = upload_base64_image(user_dict["digital_signature_url"], "inventory-assets", "users/signatures", f"{user.username}_sig", is_private=True)
        if url:
            user_dict["digital_signature_url"] = url

    new_user = models.User(**user_dict)
    new_user.warehouses = warehouses
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit.log_action(db, _admin, "user.created", f"{_admin.full_name} creó al usuario {new_user.full_name}", entity_type="user", entity_id=new_user.id)
    db.commit()
    return new_user


@router.get("/users/", response_model=List[schemas.User])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    if auth_service.is_master_admin(current_user):
        return db.query(models.User).order_by(models.User.full_name).all()

    own_keys = auth_service.visible_warehouse_keys(current_user) or []
    from sqlalchemy import or_, and_

    # IDs de usuarios asignados a las bodegas administradas por el usuario actual
    allowed_user_ids = (
        db.query(models.user_warehouses.c.user_id)
        .join(models.Warehouse, models.Warehouse.id == models.user_warehouses.c.warehouse_id)
        .filter(models.Warehouse.key.in_(own_keys))
    )

    # IDs de usuarios que tienen al menos una bodega vinculada
    has_any_warehouse_user_ids = db.query(models.user_warehouses.c.user_id)

    # Filtrado coherente para usuarios pendientes / sin bodega asignada:
    # Un admin exclusivo de FutuPro solo ve pendientes con correo de FutuPro (o sin correo asignado).
    # Un admin exclusivo de Elite solo ve pendientes de su compañía.
    is_futupro_admin = any("futu" in k.lower() for k in own_keys)
    is_elite_admin = any("elite" in k.lower() or k not in ["futupro"] for k in own_keys)

    unassigned_filter = ~models.User.id.in_(has_any_warehouse_user_ids)
    if is_futupro_admin and not is_elite_admin:
        unassigned_filter = and_(
            unassigned_filter,
            or_(models.User.email.ilike("%futupro%"), models.User.email.is_(None))
        )
    elif is_elite_admin and not is_futupro_admin:
        unassigned_filter = and_(
            unassigned_filter,
            or_(~models.User.email.ilike("%futupro%"), models.User.email.is_(None))
        )

    # Evitamos SELECT DISTINCT sobre models.User para prevenir el error en PostgreSQL
    # ("could not identify an equality operator for type json" en additional_photos)
    return (
        db.query(models.User)
        .filter(
            or_(
                models.User.id.in_(allowed_user_ids),
                unassigned_filter,
            )
        )
        .order_by(models.User.full_name)
        .all()
    )


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    is_admin = (
        _admin.role == models.RoleEnum.ADMIN
        or (isinstance(_admin.role, str) and _admin.role.lower() == "admin")
        or auth_service.is_master_admin(_admin)
    )
    if not is_admin:
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        # Si el usuario ya tiene bodegas, debe coincidir al menos una con own_keys.
        # Si no tiene bodegas asignadas aún, el encargado puede vincularlo a sus bodegas.
        if target_keys and not (own_keys & target_keys):
            raise HTTPException(status_code=403, detail="No tenés permisos para gestionar un usuario de otra bodega")
        _assert_scoped_admin_can_assign(
            _admin,
            update.role if update.role is not None else user.role,
            update.warehouse_keys if update.warehouse_keys is not None else list(target_keys),
        )

    # Validar unicidad y formato de nombre de usuario (login)
    if update.username is not None and update.username.strip().lower() != (user.username or "").strip().lower():
        cleaned_username = update.username.strip().lower()
        existing_username = db.query(models.User).filter(
            models.User.username == cleaned_username,
            models.User.id != user_id
        ).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Ese nombre de usuario ya está registrado por otro usuario")
        user.username = cleaned_username

    # Validar unicidad y formato de correo electrónico
    if update.email is not None and update.email.strip().lower() != (user.email or "").strip().lower():
        cleaned_email = update.email.strip().lower()
        validate_corporate_email(cleaned_email)
        existing_email = db.query(models.User).filter(
            models.User.email == cleaned_email,
            models.User.id != user_id
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Ese correo electrónico ya está registrado por otro usuario")
        user.email = cleaned_email

    # Validar unicidad de documento de identidad
    if update.document_id is not None and update.document_id.strip() != (user.document_id or "").strip():
        cleaned_doc = update.document_id.strip()
        existing_doc = db.query(models.User).filter(
            models.User.document_id == cleaned_doc,
            models.User.id != user_id
        ).first()
        if existing_doc:
            raise HTTPException(status_code=400, detail="Ese documento de identidad ya está registrado por otro usuario")
        user.document_id = cleaned_doc

    # Actualizar nombre completo y sincronizar custodia en activos si el gerente/persona cambia
    old_full_name = user.full_name
    if update.full_name is not None and update.full_name.strip():
        new_name = update.full_name.strip()
        user.full_name = new_name
        if old_full_name and old_full_name != new_name:
            db.query(models.Asset).filter(
                models.Asset.responsible_name == old_full_name
            ).update({models.Asset.responsible_name: new_name}, synchronize_session=False)

    # Actualizar contraseña si se proporcionó una nueva
    if update.password and update.password.strip():
        user.password_hash = auth_service.hash_password(update.password.strip())
        db.query(models.AuthToken).filter(models.AuthToken.user_id == user.id).delete()

    # Procesar foto de perfil si viene Base64 o URL
    if update.photo_url is not None:
        p_val = update.photo_url
        if p_val and p_val.startswith("data:image"):
            uploaded = upload_base64_image(p_val, "inventory-assets", "users/photos", f"{user.username}_photo")
            if uploaded:
                user.photo_url = uploaded
        else:
            user.photo_url = p_val or None

    if update.cargo is not None:
        user.cargo = update.cargo
    if update.role is not None:
        user.role = update.role
    if update.is_active is not None:
        user.is_active = update.is_active

    if update.warehouse_keys is not None:
        user.warehouses = _resolve_warehouses(db, update.warehouse_keys)

    audit.log_action(db, _admin, "user.updated", f"{_admin.full_name} editó al usuario {user.full_name}", entity_type="user", entity_id=user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    is_admin = (
        _admin.role == models.RoleEnum.ADMIN
        or (isinstance(_admin.role, str) and _admin.role.lower() == "admin")
        or auth_service.is_master_admin(_admin)
    )
    if not is_admin:
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        if not (own_keys & target_keys):
            raise HTTPException(status_code=403, detail="No tenés permiso para resetear la clave de este usuario")

    new_password = auth_service.generate_password()
    user.password_hash = auth_service.hash_password(new_password)
    audit.log_action(db, _admin, "user.password_reset", f"{_admin.full_name} generó una nueva contraseña para {user.full_name}", entity_type="user", entity_id=user.id)
    
    # Invalida todas las sesiones previas
    db.query(models.AuthToken).filter(models.AuthToken.user_id == user.id).delete()
    
    db.commit()
    return {"message": "Contraseña reseteada exitosamente", "new_password": new_password}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="No podés deshabilitar tu propio usuario")

    if not auth_service.is_master_admin(_admin):
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        if not (own_keys & target_keys):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Validación de integridad de custodia: verificar si tiene préstamos activos
    active_loans = db.query(models.Loan).filter(
        models.Loan.borrower_id == user.id,
        models.Loan.status.in_([models.LoanStatusEnum.CHECKED_OUT, models.LoanStatusEnum.APPROVED])
    ).count()
    if active_loans > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede deshabilitar al usuario '{user.full_name}' porque tiene {active_loans} préstamo(s) activo(s). Debe registrar la devolución en portería antes de darlo de baja."
        )

    # Verificar si tiene asignaciones activas
    active_assignments = db.query(models.AssetAssignment).filter(
        models.AssetAssignment.user_id == user.id,
        models.AssetAssignment.status == models.AssignmentStatusEnum.ACTIVE
    ).count()
    if active_assignments > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede deshabilitar al usuario '{user.full_name}' porque tiene {active_assignments} asignación(es) activa(s). Debe revocar las asignaciones antes de darlo de baja."
        )

    # SOFT DELETE: Inactivar usuario sin destruir historial de préstamos, asignaciones ni firmas
    user.is_active = False

    # Invalida todas las sesiones del usuario inmediatamente
    db.query(models.AuthToken).filter(models.AuthToken.user_id == user.id).delete()

    audit.log_action(db, _admin, "user.deactivated", f"{_admin.full_name} deshabilitó al usuario {user.full_name}", entity_type="user", entity_id=user_id)
    db.commit()
    return None


@router.patch("/users/{user_id}/toggle-active", response_model=schemas.User)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="No podés modificar el estado de tu propio usuario")

    if not auth_service.is_master_admin(_admin):
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        if not (own_keys & target_keys):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.is_active:
        # Validar préstamos y asignaciones antes de deshabilitar
        active_loans = db.query(models.Loan).filter(
            models.Loan.borrower_id == user.id,
            models.Loan.status.in_([models.LoanStatusEnum.CHECKED_OUT, models.LoanStatusEnum.APPROVED])
        ).count()
        if active_loans > 0:
            raise HTTPException(status_code=400, detail=f"No se puede deshabilitar porque tiene {active_loans} préstamo(s) activo(s).")

        active_assignments = db.query(models.AssetAssignment).filter(
            models.AssetAssignment.user_id == user.id,
            models.AssetAssignment.status == models.AssignmentStatusEnum.ACTIVE
        ).count()
        if active_assignments > 0:
            raise HTTPException(status_code=400, detail=f"No se puede deshabilitar porque tiene {active_assignments} asignación(es) activa(s).")

        user.is_active = False
        db.query(models.AuthToken).filter(models.AuthToken.user_id == user.id).delete()
        action_name = "user.deactivated"
        action_desc = f"{_admin.full_name} deshabilitó al usuario {user.full_name}"
    else:
        user.is_active = True
        action_name = "user.reactivated"
        action_desc = f"{_admin.full_name} reactivó al usuario {user.full_name}"

    audit.log_action(db, _admin, action_name, action_desc, entity_type="user", entity_id=user.id)
    db.commit()
    db.refresh(user)
    return user


@router.get("/role-permissions/", response_model=List[schemas.RolePermission])
def get_role_permissions(db: Session = Depends(get_db)):
    return db.query(models.RolePermission).all()
