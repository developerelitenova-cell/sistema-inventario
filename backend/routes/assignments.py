from time_util import get_colombia_time
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import auth as auth_service, audit

router = APIRouter(prefix="/assignments", tags=["Asignaciones"])


def revoke_assignment_internal(db: Session, assignment: models.AssetAssignment, actor: Optional[models.User] = None) -> models.AssetAssignment:
    assignment.status = models.AssignmentStatusEnum.REVOKED
    assignment.asset.status = models.AssetStatusEnum.AVAILABLE
    assignment.asset.responsible_name = None
    actor_name = actor.full_name if actor else "Sistema"
    audit.log_action(db, actor, "assignment.revoked", f"{actor_name} revocó la asignación #{assignment.id} ({assignment.asset.unique_code} — {assignment.user.full_name})", entity_type="assignment", entity_id=assignment.id)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/", response_model=List[schemas.Assignment])
def get_assignments(
    status_filter: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    query = db.query(models.AssetAssignment)
    if status_filter:
        try:
            query = query.filter(models.AssetAssignment.status == models.AssignmentStatusEnum(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Estado de asignación inválido")
    
    if current_user.role == models.RoleEnum.EMPLEADO:
        query = query.filter(models.AssetAssignment.user_id == current_user.id)
    elif current_user.role in (models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN):
        allowed = auth_service.visible_warehouse_keys(current_user)
        if allowed is not None:
            query = query.join(models.Asset).filter(models.Asset.module.in_(allowed))

    return query.order_by(models.AssetAssignment.expiration_date.asc()).all()


@router.post("/", response_model=schemas.Assignment)
def create_assignment(
    payload: schemas.AssignmentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset or asset.status != models.AssetStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Activo no disponible para asignar")
    if not auth_service.can_access_warehouse(current_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés asignar activos de esta bodega")

    assignment = models.AssetAssignment(
        asset_id=payload.asset_id,
        user_id=payload.user_id,
        authorized_by_id=current_user.id,
        expiration_date=get_colombia_time() + timedelta(days=payload.duration_days),
        notes=payload.notes,
        security_authorization=payload.security_authorization,
        status=models.AssignmentStatusEnum.ACTIVE,
    )
    asset.status = models.AssetStatusEnum.ASSIGNED
    
    # We must fetch the user to get their full_name, or we can just fetch it from DB
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if user:
        asset.responsible_name = user.full_name

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    audit.log_action(db, assignment.authorized_by, "assignment.created", f"Se asignó el activo {asset.unique_code} a {assignment.user.full_name}", entity_type="assignment", entity_id=assignment.id)
    db.commit()
    return assignment


@router.post("/{assignment_id}/accept", response_model=schemas.Assignment)
def accept_assignment(
    assignment_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    assignment = db.query(models.AssetAssignment).filter(models.AssetAssignment.id == assignment_id).first()
    if not assignment or assignment.status != models.AssignmentStatusEnum.ACTIVE:
        raise HTTPException(status_code=400, detail="Asignación no válida")
    
    if assignment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el asignado puede confirmar la recepción del equipo")
        
    if assignment.is_accepted:
        raise HTTPException(status_code=400, detail="El equipo ya fue confirmado previamente")

    assignment.is_accepted = True

    audit.log_action(db, current_user, "assignment.accepted", f"{current_user.full_name} confirmó la recepción física de la asignación #{assignment.id} (activo {assignment.asset.unique_code})", entity_type="assignment", entity_id=assignment.id)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{assignment_id}/renew", response_model=schemas.Assignment)
def renew_assignment(
    assignment_id: int, 
    duration_days: int = 90, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    assignment = db.query(models.AssetAssignment).filter(models.AssetAssignment.id == assignment_id).first()
    if not assignment or assignment.status != models.AssignmentStatusEnum.ACTIVE:
        raise HTTPException(status_code=400, detail="Asignación no válida para renovar")
    if not auth_service.can_access_warehouse(current_user, assignment.asset.module):
        raise HTTPException(status_code=403, detail="No podés renovar asignaciones de esta bodega")

    assignment.expiration_date = get_colombia_time() + timedelta(days=duration_days)
    audit.log_action(db, current_user, "assignment.renewed", f"Se renovó la asignación #{assignment.id} ({assignment.asset.unique_code} — {assignment.user.full_name})", entity_type="assignment", entity_id=assignment.id)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{assignment_id}/revoke", response_model=schemas.Assignment)
def revoke_assignment(
    assignment_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    assignment = db.query(models.AssetAssignment).filter(models.AssetAssignment.id == assignment_id).first()
    if not assignment or assignment.status != models.AssignmentStatusEnum.ACTIVE:
        raise HTTPException(status_code=400, detail="Asignación no válida para revocar")
    if not auth_service.can_access_warehouse(current_user, assignment.asset.module):
        raise HTTPException(status_code=403, detail="No podés revocar asignaciones de esta bodega")

    return revoke_assignment_internal(db, assignment, current_user)

@router.put("/{assignment_id}", response_model=schemas.Assignment)
def update_assignment(
    assignment_id: int, 
    payload: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    assignment = db.query(models.AssetAssignment).filter(models.AssetAssignment.id == assignment_id).first()
    if not assignment or assignment.status != models.AssignmentStatusEnum.ACTIVE:
        raise HTTPException(status_code=400, detail="Asignación no válida para actualizar")
    if not auth_service.can_access_warehouse(current_user, assignment.asset.module):
        raise HTTPException(status_code=403, detail="No podés editar asignaciones de esta bodega")

    if payload.security_authorization is not None:
        assignment.security_authorization = payload.security_authorization
    if payload.notes is not None:
        assignment.notes = payload.notes

    audit.log_action(db, current_user, "assignment.updated", f"Se actualizó la asignación #{assignment.id} ({assignment.asset.unique_code})", entity_type="assignment", entity_id=assignment.id)
    db.commit()
    db.refresh(assignment)
    return assignment
