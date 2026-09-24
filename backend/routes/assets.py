from time_util import get_colombia_time
import base64
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import qr_generator, depreciation, auth as auth_service, audit, ai_estimator
from services.asset_classifier import classify_asset
from supabase_client import upload_base64_image

router = APIRouter(tags=["Activos"])

UNUSED_THRESHOLD_DAYS = 180


class EstimateRequest(schemas.BaseModel):
    photo_data_url: str


@router.post("/assets/", response_model=schemas.Asset)
def create_asset(
    asset: schemas.AssetCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    db_asset = db.query(models.Asset).filter(models.Asset.unique_code == asset.unique_code).first()
    if db_asset:
        raise HTTPException(status_code=400, detail="Activo ya registrado")

    if not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés crear activos en una bodega a la que no tenés acceso")

    photo_url = asset.photo_url
    if photo_url and photo_url.startswith("data:image"):
        uploaded = upload_base64_image(photo_url, "inventory-assets", "assets/photos", f"{asset.unique_code}_photo")
        if uploaded:
            photo_url = uploaded

    additional_photos_uploaded = []
    if getattr(asset, 'additional_photos', None):
        for idx, p in enumerate(asset.additional_photos):
            if p and p.startswith("data:image"):
                upl = upload_base64_image(p, "inventory-assets", "assets/photos", f"{asset.unique_code}_add_{idx}")
                if upl:
                    additional_photos_uploaded.append(upl)
            elif p:
                additional_photos_uploaded.append(p)

    # Generar QR (codifica el unique_code, es lo que lee el Scanner de seguridad)
    qr_base64 = qr_generator.generate_qr_base64(asset.unique_code)

    category = asset.category or classify_asset(asset.description, asset.brand_model)

    new_asset = models.Asset(
        unique_code=asset.unique_code,
        description=asset.description,
        brand_model=asset.brand_model,
        photo_url=photo_url,
        status=asset.status,
        qr_data=qr_base64,
        module=asset.module,
        area=asset.area,
        responsible_name=asset.responsible_name,
        accessories=[acc.dict() for acc in asset.accessories] if asset.accessories else [],
        observations=asset.observations,
        category=category,
        purchase_price=asset.purchase_price,
        purchase_date=asset.purchase_date,
        value_source=models.ValueSourceEnum.MANUAL if asset.purchase_price else models.ValueSourceEnum.DESCONOCIDO,
    )
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)

    audit.log_action(db, _user, "asset.created", f"{_user.full_name} creó el activo {new_asset.unique_code} ({new_asset.description})", entity_type="asset", entity_id=new_asset.id)
    db.commit()
    return new_asset


@router.post("/assets/batch-generate", response_model=List[schemas.Asset])
def batch_generate_assets(
    payload: schemas.AssetBatchGenerate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    if payload.quantity < 1 or payload.quantity > 500:
        raise HTTPException(status_code=400, detail="La cantidad debe estar entre 1 y 500")

    if not auth_service.can_access_warehouse(_user, payload.module):
        raise HTTPException(status_code=403, detail="No podés generar códigos para una bodega a la que no tenés acceso")

    prefix = payload.prefix.strip().upper()
    if not prefix:
        raise HTTPException(status_code=400, detail="El prefijo no puede estar vacío")

    # Buscamos continuidad global para el número final, ignorando el prefijo si se desea continuidad en todos los módulos.
    if payload.start_number is not None:
        next_number = payload.start_number
    else:
        all_codes = {code for (code,) in db.query(models.Asset.unique_code).all()}
        max_number = 0
        pattern = re.compile(r"-(\d+)$")
        for code in all_codes:
            match = pattern.search(code)
            if match:
                max_number = max(max_number, int(match.group(1)))
        next_number = max_number + 1

    existing_codes = {code for (code,) in db.query(models.Asset.unique_code).all()}

    created = []
    n = next_number
    while len(created) < payload.quantity:
        code = f"{prefix}-{n:04d}"
        n += 1
        if code in existing_codes:
            continue

        qr_base64 = qr_generator.generate_qr_base64(code)
        new_asset = models.Asset(
            unique_code=code,
            description="Pendiente de registro",
            brand_model="Pendiente",
            status=models.AssetStatusEnum.PENDING_REGISTRATION,
            qr_data=qr_base64,
            module=payload.module,
        )
        db.add(new_asset)
        existing_codes.add(code)
        created.append(new_asset)

    audit.log_action(
        db, _user, "asset.batch_generated",
        f"{_user.full_name} generó {len(created)} códigos con prefijo {prefix} ({payload.module})",
        entity_type="asset",
    )
    db.commit()
    for asset in created:
        db.refresh(asset)
    return created


@router.get("/assets/by-code/{unique_code}", response_model=schemas.Asset)
def get_asset_by_code(
    unique_code: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.unique_code == unique_code).first()
    if not asset or not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=404, detail="Código no encontrado")
    return asset


@router.get("/assets/", response_model=List[schemas.Asset])
def get_assets(
    module: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    if current_user.role == models.RoleEnum.EMPLEADO:
        raise HTTPException(status_code=403, detail="Los empleados no tienen acceso al catálogo de activos")
    if module and not auth_service.can_access_warehouse(current_user, module):
        raise HTTPException(status_code=403, detail="No tenés acceso a esa bodega")

    query = db.query(models.Asset)
    if module:
        query = query.filter(models.Asset.module == module)
    else:
        allowed = auth_service.visible_warehouse_keys(current_user)
        if allowed is not None:
            query = query.filter(models.Asset.module.in_(allowed))
    assets = query.all()

    if current_user.role not in (models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO):
        for asset in assets:
            asset.value = None
            asset.purchase_price = None
            asset.estimated_value = None

    return assets


@router.get("/assets/availability", response_model=schemas.AssetAvailability)
def get_asset_availability(
    category: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    try:
        cat_enum = models.CategoryEnum(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Categoría inválida")

    query = db.query(models.Asset).filter(models.Asset.category == cat_enum)
    allowed = auth_service.visible_warehouse_keys(current_user)
    if allowed is not None:
        query = query.filter(models.Asset.module.in_(allowed))
    assets = query.all()

    available_count = sum(1 for a in assets if a.status == models.AssetStatusEnum.AVAILABLE)
    busy = [a for a in assets if a.status in (models.AssetStatusEnum.ASSIGNED, models.AssetStatusEnum.LOANED)]
    busy_areas = sorted({a.area for a in busy if a.area})

    return schemas.AssetAvailability(
        available_count=available_count,
        busy_count=len(busy),
        busy_areas=busy_areas,
    )


@router.get("/assets/unused", response_model=List[dict])
def get_unused_assets(
    module: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    if module and not auth_service.can_access_warehouse(current_user, module):
        raise HTTPException(status_code=403, detail="No tenés acceso a esa bodega")

    threshold = get_colombia_time() - timedelta(days=UNUSED_THRESHOLD_DAYS)
    query = db.query(models.Asset).filter(models.Asset.status == models.AssetStatusEnum.AVAILABLE)
    if module:
        query = query.filter(models.Asset.module == module)
    else:
        allowed = auth_service.visible_warehouse_keys(current_user)
        if allowed is not None:
            query = query.filter(models.Asset.module.in_(allowed))

    results = []
    for asset in query.all():
        last_loan = (
            db.query(models.Loan)
            .filter(models.Loan.asset_id == asset.id)
            .order_by(models.Loan.request_date.desc())
            .first()
        )
        last_activity = None
        if last_loan:
            last_activity = last_loan.return_date or last_loan.checkout_date or last_loan.request_date

        is_unused = last_loan is None or (last_activity is not None and last_activity < threshold)
        if not is_unused:
            continue

        days_since = (get_colombia_time() - last_activity).days if last_activity else None
        results.append({
            "id": asset.id,
            "unique_code": asset.unique_code,
            "description": asset.description,
            "brand_model": asset.brand_model,
            "module": asset.module,
            "area": asset.area,
            "days_since_last_use": days_since,
            "estimated_value": asset.estimated_value,
            "purchase_price": asset.purchase_price,
        })

    results.sort(key=lambda r: r["days_since_last_use"] if r["days_since_last_use"] is not None else 10**9, reverse=True)
    return results


@router.put("/assets/{asset_id}", response_model=schemas.Asset)
def update_asset(
    asset_id: int,
    update: schemas.AssetUpdate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    if not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés editar activos de esta bodega")
    if update.module and not auth_service.can_access_warehouse(_user, update.module):
        raise HTTPException(status_code=403, detail="No podés mover el activo a esa bodega")

    for field, value in update.model_dump(exclude_unset=True).items():
        if field == "accessories":
            setattr(asset, field, [acc.dict() for acc in value] if value else [])
        else:
            setattr(asset, field, value)

    if update.purchase_price is not None:
        asset.value_source = models.ValueSourceEnum.MANUAL

    audit.log_action(db, _user, "asset.updated", f"{_user.full_name} editó el activo {asset.unique_code}", entity_type="asset", entity_id=asset.id)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/assets/{asset_id}/photo", response_model=schemas.Asset)
async def upload_asset_photo(
    asset_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    if not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés editar la foto de este activo")

    if photo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado (usar JPEG, PNG o WEBP)")

    photo_bytes = await photo.read()
    b64 = base64.b64encode(photo_bytes).decode()
    data_uri = f"data:{photo.content_type};base64,{b64}"

    uploaded_url = upload_base64_image(data_uri, "inventory-assets", "assets/photos", f"{asset.unique_code}_photo")
    asset.photo_url = uploaded_url or data_uri  # si Supabase falla, al menos no se pierde la foto

    db.commit()
    db.refresh(asset)
    return asset


@router.get("/assets/{asset_id}/depreciation", response_model=dict)
def get_asset_depreciation(
    asset_id: int, 
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    if not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés ver la depreciación de este activo")
    return depreciation.calculate_depreciation(asset)


@router.post("/assets/{asset_id}/qr")
def regenerate_qr(
    asset_id: int, 
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO)),
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    if not auth_service.can_access_warehouse(_user, asset.module):
        raise HTTPException(status_code=403, detail="No podés regenerar el QR de este activo")
    
    asset.qr_data = qr_generator.generate_qr_base64(asset.unique_code)
    db.commit()
    return {"message": "QR regenerado", "qr_data": asset.qr_data}


@router.post("/api/assets/estimate")
@router.post("/assets/estimate")
def estimate_asset_value(
    req: EstimateRequest,
    _user: models.User = Depends(auth_service.get_current_user),
):
    try:
        result = ai_estimator.estimate_asset_value(req.photo_data_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assets/verify/{unique_code}", response_model=dict)
def verify_asset_status(
    unique_code: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.require_role(models.RoleEnum.ADMIN, models.RoleEnum.ENCARGADO, models.RoleEnum.SALIDA)),
):
    asset = db.query(models.Asset).filter(models.Asset.unique_code == unique_code).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    active_loan = (
        db.query(models.Loan)
        .filter(
            models.Loan.asset_id == asset.id,
            models.Loan.status.in_([
                models.LoanStatusEnum.PENDING,
                models.LoanStatusEnum.APPROVED, 
                models.LoanStatusEnum.CHECKED_OUT
            ]),
        )
        .order_by(models.Loan.request_date.desc())
        .first()
    )

    active_assignment = None
    if not active_loan and asset.status == models.AssetStatusEnum.ASSIGNED:
        active_assignment = (
            db.query(models.AssetAssignment)
            .filter(
                models.AssetAssignment.asset_id == asset.id,
                models.AssetAssignment.status == models.AssignmentStatusEnum.ACTIVE
            )
            .first()
        )

    is_authorized = False
    if active_loan:
        is_authorized = (
            active_loan.status in [models.LoanStatusEnum.APPROVED, models.LoanStatusEnum.CHECKED_OUT]
            and active_loan.security_authorization == "AUTORIZADO_SALIDA"
        )
    elif active_assignment:
        is_authorized = active_assignment.security_authorization == "AUTORIZADO_SALIDA"

    borrower = active_loan.borrower if active_loan else (active_assignment.user if active_assignment else None)
    has_signature = bool(borrower.digital_signature_url) if borrower else False

    loan_status_val = None
    if active_loan:
        loan_status_val = active_loan.status.value
    elif active_assignment:
        loan_status_val = 'assignment'

    return {
        "asset_code": asset.unique_code,
        "asset_description": asset.description,
        "status": asset.status.value,
        "is_authorized_to_leave": is_authorized,
        "loan_status": loan_status_val,
        "loan_id": active_loan.id if active_loan else None,
        "borrower_name": borrower.full_name if borrower else None,
        "borrower_photo": borrower.photo_url if borrower else None,
        "borrower_document_id": borrower.document_id if borrower else None,
        "borrower_signature": "FIRMA_REGISTRADA" if has_signature else None,
        "has_digital_signature": has_signature,
    }
@router.get("/assets/{asset_id}/holder")
def get_asset_holder(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    if asset.status == models.AssetStatusEnum.ASSIGNED:
        assignment = db.query(models.AssetAssignment).filter(models.AssetAssignment.asset_id == asset_id, models.AssetAssignment.status == models.AssignmentStatusEnum.ACTIVE).first()
        if assignment:
            return {"type": "assignment", "user": assignment.user, "since": assignment.start_date, "notes": assignment.notes}
            
    if asset.status == models.AssetStatusEnum.LOANED:
        loan = db.query(models.Loan).filter(models.Loan.asset_id == asset_id, models.Loan.status == models.LoanStatusEnum.CHECKED_OUT).first()
        if loan:
            return {"type": "loan", "user": loan.borrower, "since": loan.checkout_date, "notes": loan.reason}
            
    raise HTTPException(status_code=404, detail="El activo no tiene un responsable activo registrado en el sistema")
