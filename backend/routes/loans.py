from time_util import get_colombia_time
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import biometrics, auth as auth_service, audit
from supabase_client import upload_base64_image
from routes.assignments import revoke_assignment_internal

router = APIRouter(tags=["Préstamos"])


class SecurityCheckoutRequest(BaseModel):
    security_signature_base64: str
    borrowed_accessories: Optional[List[schemas.AccessoryItem]] = None


@router.get("/loans/", response_model=List[schemas.Loan])
def get_loans(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    query = db.query(models.Loan)
    if status_filter:
        try:
            query = query.filter(models.Loan.status == models.LoanStatusEnum(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Estado de préstamo inválido")

    if current_user.role == models.RoleEnum.EMPLEADO:
        query = query.filter(models.Loan.borrower_id == current_user.id)
    elif current_user.role in (models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN):
        allowed = auth_service.visible_warehouse_keys(current_user)
        if allowed is not None:
            query = query.join(models.Asset).filter(models.Asset.module.in_(allowed))

    return query.order_by(models.Loan.request_date.desc()).all()


@router.get("/loans/{loan_id}", response_model=schemas.Loan)
def get_loan(
    loan_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
        
    if current_user.role == models.RoleEnum.EMPLEADO and loan.borrower_id != current_user.id:
        raise HTTPException(status_code=403, detail="No podés ver préstamos de otros usuarios")
    elif current_user.role in (models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN):
        if not auth_service.can_access_warehouse(current_user, loan.asset.module):
            raise HTTPException(status_code=403, detail="No podés ver préstamos de esta bodega")
            
    return loan


@router.post("/loans/request", response_model=schemas.Loan)
def request_loan(
    loan_req: schemas.LoanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    # Verificar si el activo está disponible
    asset = db.query(models.Asset).filter(models.Asset.id == loan_req.asset_id).first()
    if not asset or asset.status != models.AssetStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Activo no disponible para préstamo")

    new_loan = models.Loan(
        asset_id=loan_req.asset_id,
        borrower_id=current_user.id,
        reason=loan_req.reason,
        status=models.LoanStatusEnum.PENDING
    )
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)

    audit.log_action(db, current_user, "loan.requested", f"{current_user.full_name} solicitó el préstamo del activo {asset.unique_code}", entity_type="loan", entity_id=new_loan.id)
    db.commit()
    return new_loan


@router.post("/loans/direct", response_model=schemas.Loan)
def create_direct_loan(
    loan_req: schemas.DirectLoanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN)),
):
    # Verificar si el activo está disponible
    asset = db.query(models.Asset).filter(models.Asset.id == loan_req.asset_id).first()
    if not asset or asset.status != models.AssetStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Activo no disponible para préstamo")
    if not auth_service.can_access_warehouse(current_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés prestar un activo de una bodega a la que no tenés acceso")

    asset.status = models.AssetStatusEnum.LOANED

    new_loan = models.Loan(
        asset_id=loan_req.asset_id,
        borrower_id=loan_req.borrower_id,
        reason=loan_req.reason,
        status=models.LoanStatusEnum.APPROVED,
        approver_id=current_user.id,
        approval_date=get_colombia_time(),
        security_authorization="AUTORIZADO_SALIDA" if loan_req.requires_exit_pass else "USO_INTERNO",
    )
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)

    borrower = db.query(models.User).filter(models.User.id == loan_req.borrower_id).first()
    borrower_name = borrower.full_name if borrower else "Usuario"

    audit.log_action(db, current_user, "loan.direct", f"{current_user.full_name} prestó directamente el activo {asset.unique_code} a {borrower_name}", entity_type="loan", entity_id=new_loan.id)
    db.commit()
    return new_loan


@router.post("/loans/{loan_id}/approve", response_model=schemas.Loan)
def approve_loan(
    loan_id: int,
    approval: schemas.LoanApproval,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN)),
):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan or loan.status != models.LoanStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Préstamo no válido para aprobación")
    if not auth_service.can_access_warehouse(current_user, loan.asset.module):
        raise HTTPException(status_code=403, detail="No tenés permiso para aprobar préstamos de esta bodega")

    loan.approver_id = current_user.id
    loan.approval_date = get_colombia_time()
    loan.status = models.LoanStatusEnum.APPROVED if approval.approved else models.LoanStatusEnum.REJECTED

    if approval.approved:
        loan.asset.status = models.AssetStatusEnum.LOANED
        loan.security_authorization = "AUTORIZADO_SALIDA" if approval.requires_exit_pass else "USO_INTERNO"

    verb = "aprobó" if approval.approved else "rechazó"
    audit.log_action(db, current_user, f"loan.{loan.status.value}", f"{current_user.full_name} {verb} el préstamo #{loan.id}", entity_type="loan", entity_id=loan.id)
    db.commit()
    db.refresh(loan)
    return loan


@router.post("/loans/{loan_id}/checkout", response_model=schemas.Loan)
async def checkout_loan(
    loan_id: int, 
    face_image: UploadFile = File(...), 
    id_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.SALIDA, models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan or loan.status != models.LoanStatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Préstamo no aprobado para salida")
    if loan.security_authorization != "AUTORIZADO_SALIDA":
        raise HTTPException(status_code=403, detail="Este préstamo es de uso interno: no tiene autorización de salida")

    # Leer bytes
    face_bytes = await face_image.read()
    id_bytes = await id_image.read()
    
    # Validar biométricamente
    is_valid = biometrics.validate_face_and_id(face_bytes, id_bytes)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Validación biométrica fallida")
        
    # Actualizar préstamo y activo
    loan.status = models.LoanStatusEnum.CHECKED_OUT
    loan.checkout_date = get_colombia_time()
    loan.asset.status = models.AssetStatusEnum.LOANED
    loan.asset.responsible_name = loan.borrower.full_name
    loan.borrowed_accessories = loan.asset.accessories

    audit.log_action(db, current_user, "loan.checked_out", f"{current_user.full_name} registró la salida del préstamo #{loan.id} (activo {loan.asset.unique_code}) con validación biométrica", entity_type="loan", entity_id=loan.id)
    db.commit()
    db.refresh(loan)
    return loan


@router.post("/loans/{loan_id}/checkout-security", response_model=schemas.Loan)
def checkout_loan_security(
    loan_id: int,
    request: SecurityCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.SALIDA, models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan or loan.status != models.LoanStatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Préstamo no aprobado o no válido para salida de seguridad")
    if loan.security_authorization != "AUTORIZADO_SALIDA":
        raise HTTPException(status_code=403, detail="Este préstamo es de uso interno: no tiene autorización de salida")

    # Subir firma del guardia (Pentágono)
    sig_url = upload_base64_image(request.security_signature_base64, "inventory-assets", "security/signatures", f"loan_{loan_id}_security_sig", is_private=True)
    if sig_url:
        loan.security_signature_url = sig_url

    loan.status = models.LoanStatusEnum.CHECKED_OUT
    loan.checkout_date = get_colombia_time()
    loan.asset.status = models.AssetStatusEnum.LOANED

    if request.borrowed_accessories is not None:
        loan.borrowed_accessories = [acc.dict() for acc in request.borrowed_accessories]
    else:
        loan.borrowed_accessories = loan.asset.accessories

    audit.log_action(db, current_user, "loan.checked_out", f"{current_user.full_name} (Personal de salida) registró la salida del préstamo #{loan.id} (activo {loan.asset.unique_code})", entity_type="loan", entity_id=loan.id)
    db.commit()
    db.refresh(loan)
    return loan


@router.post("/loans/{loan_id}/return", response_model=schemas.Loan)
def return_loan(
    loan_id: int,
    payload: Optional[schemas.LoanReturn] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO, models.RoleEnum.SALIDA)),
):
    payload = payload or schemas.LoanReturn()
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan or loan.status not in [models.LoanStatusEnum.CHECKED_OUT, models.LoanStatusEnum.APPROVED]:
        raise HTTPException(status_code=400, detail="Préstamo no válido para devolución")

    if current_user.role in (models.RoleEnum.ENCARGADO, models.RoleEnum.ADMIN) and not auth_service.can_access_warehouse(current_user, loan.asset.module):
        raise HTTPException(status_code=403, detail="No tiene permisos para devolver activos de este módulo")

    loan.status = models.LoanStatusEnum.RETURNED
    loan.return_date = get_colombia_time()
    
    if payload.condition_status and payload.condition_status.upper() in ["DAÑADO", "INCOMPLETO", "PERDIDO"]:
        loan.asset.status = models.AssetStatusEnum.MAINTENANCE
    else:
        loan.asset.status = models.AssetStatusEnum.AVAILABLE
    loan.asset.responsible_name = None

    if payload.observations:
        if loan.observations:
            loan.observations = f"{loan.observations}\n\n[Devolución]: {payload.observations}"
        else:
            loan.observations = payload.observations
            
    if payload.condition_status:
        loan.condition_status = payload.condition_status

    audit.log_action(db, current_user, "loan.returned", f"{current_user.full_name} registró la devolución del activo {loan.asset.unique_code}", entity_type="loan", entity_id=loan.id)
    db.commit()
    db.refresh(loan)
    return loan


@router.post("/assets/{asset_id}/return")
def return_asset(
    asset_id: int,
    payload: Optional[schemas.LoanReturn] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    if current_user.role == models.RoleEnum.ENCARGADO and not auth_service.can_access_warehouse(current_user, asset.module):
        raise HTTPException(status_code=403, detail="No tiene permisos para devolver activos de este módulo")

    loan = db.query(models.Loan).filter(
        models.Loan.asset_id == asset.id,
        models.Loan.status.in_([models.LoanStatusEnum.CHECKED_OUT, models.LoanStatusEnum.APPROVED])
    ).first()

    if not loan:
        # Si no hay préstamo, buscar si hay una asignación activa
        assignment = db.query(models.AssetAssignment).filter(
            models.AssetAssignment.asset_id == asset.id,
            models.AssetAssignment.status == models.AssignmentStatusEnum.ACTIVE
        ).first()

        if assignment:
            # Revocar la asignación
            revoke_assignment_internal(db, assignment, current_user)
            return {"status": "ok", "message": "Asignación revocada y activo devuelto"}

        # Permitir devolución forzosa si el estado quedó trabado
        if asset.status in (models.AssetStatusEnum.LOANED, models.AssetStatusEnum.ASSIGNED):
            asset.status = models.AssetStatusEnum.AVAILABLE
            db.commit()
            return {"status": "ok", "message": "Activo devuelto forzosamente (sin registro)"}

        raise HTTPException(status_code=400, detail="No hay préstamo ni asignación activa para este activo.")

    return return_loan(loan.id, payload, db, current_user)
