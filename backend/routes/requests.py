from time_util import get_colombia_time
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import auth as auth_service, audit

router = APIRouter(prefix="/asset-requests", tags=["Solicitudes de Activos"])


def _can_access_asset_request(current_user: "models.User", asset_request: "models.AssetRequest") -> bool:
    if current_user.id == asset_request.requester_id:
        return True
    if current_user.role in (models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO) and auth_service.can_access_warehouse(current_user, asset_request.module):
        return True
    return False


@router.post("/", response_model=schemas.AssetRequest)
def create_asset_request(
    payload: schemas.AssetRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    if payload.module and not auth_service.can_access_warehouse(current_user, payload.module):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta bodega")

    new_request = models.AssetRequest(
        requester_id=current_user.id,
        module=payload.module,
        category_requested=payload.category_requested,
        description=payload.description,
        status=models.RequestStatusEnum.PENDING,
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    audit.log_action(db, current_user, "asset_request.created", f"{current_user.full_name} solicitó un activo: {new_request.description}", entity_type="asset_request", entity_id=new_request.id)
    db.commit()
    return new_request


@router.get("/mine", response_model=List[schemas.AssetRequest])
def get_my_asset_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    return (
        db.query(models.AssetRequest)
        .filter(models.AssetRequest.requester_id == current_user.id)
        .order_by(models.AssetRequest.created_at.desc())
        .all()
    )


@router.get("/", response_model=List[schemas.AssetRequest])
def get_asset_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN)),
):
    query = db.query(models.AssetRequest)
    if status_filter:
        try:
            query = query.filter(models.AssetRequest.status == models.RequestStatusEnum(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Estado de solicitud inválido")

    if current_user.role in (models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN):
        allowed = auth_service.visible_warehouse_keys(current_user)
        if allowed is not None:
            from sqlalchemy import or_
            query = query.filter(or_(models.AssetRequest.module.in_(allowed), models.AssetRequest.module == None))

    return query.order_by(models.AssetRequest.created_at.desc()).all()


@router.post("/{request_id}/assign", response_model=schemas.AssetRequest)
def assign_asset_request(
    request_id: int,
    payload: schemas.AssetRequestAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN)),
):
    asset_request = db.query(models.AssetRequest).filter(models.AssetRequest.id == request_id).first()
    if not asset_request or asset_request.status != models.RequestStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Solicitud no válida para asignar")
    if not auth_service.can_access_warehouse(current_user, asset_request.module):
        raise HTTPException(status_code=403, detail="No tenés permiso para gestionar esta solicitud")

    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset or asset.status != models.AssetStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Activo no disponible para asignar")
    if not auth_service.can_access_warehouse(current_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés asignar un activo de una bodega a la que no tenés acceso")

    new_loan = models.Loan(
        asset_id=asset.id,
        borrower_id=asset_request.requester_id,
        approver_id=current_user.id,
        reason=asset_request.description,
        status=models.LoanStatusEnum.APPROVED,
        approval_date=get_colombia_time(),
        security_authorization="AUTORIZADO_SALIDA" if payload.requires_exit_pass else "USO_INTERNO"
    )
    db.add(new_loan)
    db.flush()

    asset_request.status = models.RequestStatusEnum.ASSIGNED
    asset_request.reviewed_by_id = current_user.id
    asset_request.reviewed_at = get_colombia_time()
    asset_request.review_notes = payload.notes
    asset_request.resulting_loan_id = new_loan.id

    asset.status = models.AssetStatusEnum.LOANED

    audit.log_action(
        db, current_user, "asset_request.assigned",
        f"{current_user.full_name} asignó el activo {asset.unique_code} a la solicitud de {asset_request.requester.full_name}",
        entity_type="asset_request", entity_id=asset_request.id,
    )
    db.commit()
    db.refresh(asset_request)
    return asset_request


@router.post("/{request_id}/reject", response_model=schemas.AssetRequest)
def reject_asset_request(
    request_id: int,
    payload: schemas.AssetRequestReject,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN)),
):
    asset_request = db.query(models.AssetRequest).filter(models.AssetRequest.id == request_id).first()
    if not asset_request or asset_request.status != models.RequestStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Solicitud no válida para rechazar")
    if not auth_service.can_access_warehouse(current_user, asset_request.module):
        raise HTTPException(status_code=403, detail="No tenés permiso para gestionar esta solicitud")

    asset_request.status = models.RequestStatusEnum.REJECTED
    asset_request.reviewed_by_id = current_user.id
    asset_request.reviewed_at = get_colombia_time()
    asset_request.review_notes = payload.notes

    audit.log_action(
        db, current_user, "asset_request.rejected",
        f"{current_user.full_name} rechazó la solicitud de {asset_request.requester.full_name}",
        entity_type="asset_request", entity_id=asset_request.id,
    )
    db.commit()
    db.refresh(asset_request)
    return asset_request


@router.get("/{request_id}/comments", response_model=List[schemas.RequestComment])
def get_request_comments(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    asset_request = db.query(models.AssetRequest).filter(models.AssetRequest.id == request_id).first()
    if not asset_request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if not _can_access_asset_request(current_user, asset_request):
        raise HTTPException(status_code=403, detail="No tenés permiso para ver esta solicitud")

    return (
        db.query(models.RequestComment)
        .filter(models.RequestComment.asset_request_id == request_id)
        .order_by(models.RequestComment.created_at.asc())
        .all()
    )


@router.post("/{request_id}/comments", response_model=schemas.RequestComment)
def create_request_comment(
    request_id: int,
    payload: schemas.RequestCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    asset_request = db.query(models.AssetRequest).filter(models.AssetRequest.id == request_id).first()
    if not asset_request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if not _can_access_asset_request(current_user, asset_request):
        raise HTTPException(status_code=403, detail="No tenés permiso para comentar esta solicitud")

    comment = models.RequestComment(
        asset_request_id=request_id,
        author_id=current_user.id,
        message=payload.message,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    audit.log_action(
        db, current_user, "asset_request.commented",
        f"{current_user.full_name} comentó en la solicitud de {asset_request.requester.full_name}",
        entity_type="asset_request", entity_id=asset_request.id,
    )
    db.commit()
    return comment
