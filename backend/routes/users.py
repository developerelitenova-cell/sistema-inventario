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
    if auth_service.is_master_admin(admin):
        return
    if role == models.RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Solo el administrador maestro puede asignar el rol Administrador")
    own_keys = set(auth_service.visible_warehouse_keys(admin) or [])
    if not set(warehouse_keys).issubset(own_keys):
        raise HTTPException(status_code=403, detail="No podés otorgar acceso a una bodega que vos mismo no administrás")


@router.post("/users/", response_model=schemas.User)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username ya registrado")

    _assert_scoped_admin_can_assign(_admin, user.role, user.warehouse_keys)
    warehouses = _resolve_warehouses(db, user.warehouse_keys)

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
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    if auth_service.is_master_admin(current_user):
        return db.query(models.User).all()

    own_keys = auth_service.visible_warehouse_keys(current_user) or []
    return (
        db.query(models.User)
        .join(models.user_warehouses, models.User.id == models.user_warehouses.c.user_id)
        .join(models.Warehouse, models.Warehouse.id == models.user_warehouses.c.warehouse_id)
        .filter(models.Warehouse.key.in_(own_keys))
        .distinct()
        .all()
    )


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not auth_service.is_master_admin(_admin):
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        if not (own_keys & target_keys):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        _assert_scoped_admin_can_assign(
            _admin,
            update.role if update.role is not None else user.role,
            update.warehouse_keys if update.warehouse_keys is not None else list(target_keys),
        )

    if update.warehouse_keys is not None:
        user.warehouses = _resolve_warehouses(db, update.warehouse_keys)

    for field, value in update.dict(exclude_unset=True, exclude={"warehouse_keys"}).items():
        setattr(user, field, value)
    audit.log_action(db, _admin, "user.updated", f"{_admin.full_name} editó al usuario {user.full_name}", entity_type="user", entity_id=user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not auth_service.is_master_admin(_admin):
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
        raise HTTPException(status_code=400, detail="No podés borrar tu propio usuario")

    if not auth_service.is_master_admin(_admin):
        own_keys = set(auth_service.visible_warehouse_keys(_admin) or [])
        target_keys = {w.key for w in user.warehouses}
        if not (own_keys & target_keys):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Borrado en cascada de entidades pertenecientes al usuario
    db.query(models.RequestComment).filter(models.RequestComment.author_id == user.id).delete(synchronize_session=False)
    db.query(models.AssetRequest).filter(models.AssetRequest.requester_id == user.id).delete(synchronize_session=False)
    db.query(models.Loan).filter(models.Loan.borrower_id == user.id).delete(synchronize_session=False)
    db.query(models.AssetAssignment).filter(models.AssetAssignment.user_id == user.id).delete(synchronize_session=False)

    # Limpiar referencias donde el usuario actuó como admin o aprobador (poner en NULL)
    db.query(models.Loan).filter(models.Loan.approver_id == user.id).update({models.Loan.approver_id: None}, synchronize_session=False)
    db.query(models.AssetRequest).filter(models.AssetRequest.reviewed_by_id == user.id).update({models.AssetRequest.reviewed_by_id: None}, synchronize_session=False)
    db.query(models.AssetAssignment).filter(models.AssetAssignment.authorized_by_id == user.id).update({models.AssetAssignment.authorized_by_id: None}, synchronize_session=False)
    db.query(models.ActivityLog).filter(models.ActivityLog.actor_id == user.id).update({models.ActivityLog.actor_id: None}, synchronize_session=False)

    db.query(models.AuthToken).filter(models.AuthToken.user_id == user.id).delete()
    user.warehouses = []
    db.delete(user)
    audit.log_action(db, _admin, "user.deleted", f"{_admin.full_name} borró al usuario {user.full_name}", entity_type="user", entity_id=user_id)
    db.commit()
    return None


@router.get("/role-permissions/", response_model=List[schemas.RolePermission])
def get_role_permissions(db: Session = Depends(get_db)):
    return db.query(models.RolePermission).all()
