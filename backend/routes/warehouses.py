import re
import unicodedata
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import auth as auth_service, audit

router = APIRouter(prefix="/warehouses", tags=["Bodegas"])


def _slugify_key(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", normalized).strip("_").lower()
    return slug or "bodega"


@router.get("/public", response_model=List[schemas.Warehouse])
def get_public_warehouses(db: Session = Depends(get_db)):
    return db.query(models.Warehouse).order_by(models.Warehouse.name).all()


@router.get("/", response_model=List[schemas.Warehouse])
def get_warehouses(
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.get_current_user),
):
    query = db.query(models.Warehouse)
    allowed_keys = auth_service.visible_warehouse_keys(_user)
    if allowed_keys is not None:
        query = query.filter(models.Warehouse.key.in_(allowed_keys))
    return query.order_by(models.Warehouse.name).all()


@router.post("/", response_model=schemas.Warehouse)
def create_warehouse(
    payload: schemas.WarehouseCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_master_admin()),
):
    key = _slugify_key(payload.key)
    if db.query(models.Warehouse).filter(models.Warehouse.key == key).first():
        raise HTTPException(status_code=400, detail="Ya existe una bodega con esa clave")

    warehouse = models.Warehouse(key=key, name=payload.name.strip())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)

    audit.log_action(db, _admin, "warehouse.created", f"{_admin.full_name} creó la bodega {warehouse.name}", entity_type="warehouse", entity_id=warehouse.id)
    db.commit()
    return warehouse


@router.put("/{warehouse_id}", response_model=schemas.Warehouse)
def update_warehouse(
    warehouse_id: int,
    payload: schemas.WarehouseUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN)),
):
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")

    if not auth_service.can_access_warehouse(_admin, warehouse.key):
        raise HTTPException(status_code=403, detail="No podés gestionar una bodega que no administrás")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(warehouse, field, value)

    audit.log_action(db, _admin, "warehouse.updated", f"{_admin.full_name} editó la bodega {warehouse.name}", entity_type="warehouse", entity_id=warehouse.id)
    db.commit()
    db.refresh(warehouse)
    return warehouse
