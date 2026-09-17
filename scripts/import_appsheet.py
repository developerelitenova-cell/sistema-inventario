"""
Importación única (one-time) del catálogo de activos y el historial de préstamos
desde la app de AppSheet "Elite Nutrition - Pentágono" hacia la base de datos
local del Sistema de Inventario.

Fuente:
  - Tabla "BD"        -> catálogo maestro de activos (1794 registros)
  - Tabla "Préstamos"  -> historial de préstamos (122 registros)

Requiere backend/.env con APPSHEET_APP_ID y APPSHEET_ACCESS_KEY.
"""
import os
import re
import sys
import logging
import unicodedata
from datetime import datetime

import requests
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

import models
from database import Base, engine, SessionLocal
from services.qr_generator import generate_qr_base64

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("import_appsheet")

APP_ID = os.environ.get("APPSHEET_APP_ID")
ACCESS_KEY = os.environ.get("APPSHEET_ACCESS_KEY")
API_URL = "https://api.appsheet.com/api/v2/apps/{app_id}/tables/{table}/Action"

DATE_FORMATS = ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"]


def fetch_table(table_name: str, app_id: str | None = None, access_key: str | None = None) -> list:
    headers = {
        "ApplicationAccessKey": access_key or ACCESS_KEY,
        "Content-Type": "application/json",
    }
    body = {"Action": "Find", "Properties": {"Locale": "es-CO"}, "Rows": []}
    resp = requests.post(
        API_URL.format(app_id=app_id or APP_ID, table=table_name),
        headers=headers,
        json=body,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def parse_date(value):
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    logger.warning("No se pudo parsear la fecha: %r", value)
    return None


def parse_value(value):
    if not value:
        return None
    cleaned = re.sub(r"[^\d.]", "", value)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", ".", normalized).strip(".").lower()
    return slug or "usuario"


def get_or_create_user(db, full_name: str, default_role: "models.RoleEnum"):
    full_name = (full_name or "").strip()
    if not full_name:
        return None

    user = db.query(models.User).filter(models.User.full_name == full_name).first()
    if user:
        return user

    base_username = slugify(full_name)
    username = base_username
    suffix = 1
    while db.query(models.User).filter(models.User.username == username).first():
        suffix += 1
        username = f"{base_username}.{suffix}"

    user = models.User(
        username=username,
        full_name=full_name,
        document_id=f"IMPORT-{username}",
        role=default_role,
    )
    db.add(user)
    db.flush()
    return user


def import_assets(db, rows: list, force_module: "models.ModuleEnum | None" = None) -> dict:
    created, updated, skipped = 0, 0, 0

    for row in rows:
        code = (row.get("Código") or "").strip()
        if not code:
            skipped += 1
            continue

        asset = db.query(models.Asset).filter(models.Asset.unique_code == code).first()
        is_new = asset is None
        if is_new:
            asset = models.Asset(unique_code=code, qr_data=generate_qr_base64(code))

        asset.description = row.get("Descripción") or asset.description or "Sin descripción"
        asset.brand_model = row.get("Marca o Modelo") or asset.brand_model or ""
        asset.area = row.get("Área") or None
        asset.responsible_name = row.get("Responsable") or None
        asset.value = parse_value(row.get("Valor"))
        asset.accessory_1 = row.get("Accesorio 1") or None
        asset.accessory_2 = row.get("Accesorio 2") or None
        asset.accessory_3 = row.get("Accesorio 3") or None
        asset.observations = row.get("Observación") or None
        asset.appsheet_photo_ref = row.get("Foto") or None
        if force_module is not None:
            asset.module = force_module

        if is_new:
            asset.status = models.AssetStatusEnum.AVAILABLE
            db.add(asset)
            created += 1
        else:
            updated += 1

    db.flush()
    return {"created": created, "updated": updated, "skipped": skipped}


def import_loans(db, rows: list) -> dict:
    created, updated, skipped_no_asset = 0, 0, 0

    # Ordenar por fecha de entrega para que el último préstamo de cada activo
    # sea el que determine el estado actual del activo.
    rows_sorted = sorted(rows, key=lambda r: parse_date(r.get("Fecha de Entrega")) or datetime.min)

    for row in rows_sorted:
        code = (row.get("Código") or "").strip()
        external_id = (row.get("ID") or "").strip() or None

        asset = db.query(models.Asset).filter(models.Asset.unique_code == code).first()
        if not asset:
            # Construir la lista de accesorios en base a las columnas originales (si se tienen los datos, ej de row u otra lógica).
            # Asumiendo que row tiene accessory_1, accessory_2, accessory_3:
            accessories = []
            for col in ['accessory_1', 'accessory_2', 'accessory_3', 'Accesorio 1', 'Accesorio 2', 'Accesorio 3']:
                if col in row and row[col]:
                    val = str(row[col]).strip()
                    if val.lower() not in ['nan', 'none', '']:
                        accessories.append({
                            "name": val,
                            "is_linked_asset": False,
                            "linked_asset_code": None
                        })
            asset = models.Asset(
                unique_code=code,
                qr_data=generate_qr_base64(code),
                description=row.get("Descripción") or "Sin descripción",
                accessories=accessories,
                status=models.AssetStatusEnum.AVAILABLE
            )
            db.add(asset)
            db.flush()

        loan = None
        if external_id:
            loan = db.query(models.Loan).filter(models.Loan.external_id == external_id).first()
        is_new = loan is None
        if is_new:
            loan = models.Loan(external_id=external_id)

        borrower = get_or_create_user(db, row.get("Prestamo A (Nombre Completo)"), models.RoleEnum.EMPLEADO)
        approver = get_or_create_user(db, row.get("Autorización Pentágono"), models.RoleEnum.ENCARGADO)

        checkout_date = parse_date(row.get("Fecha de Entrega"))
        return_date = parse_date(row.get("Fecha Devolución"))

        loan.asset_id = asset.id
        loan.borrower_id = borrower.id if borrower else loan.borrower_id
        loan.approver_id = approver.id if approver else loan.approver_id
        loan.reason = None
        loan.observations = row.get("Observación") or None
        loan.condition_status = row.get("Estado") or None
        loan.security_authorization = row.get("Autorización Seguridad") or None
        loan.signature_ref = row.get("Firma") or None

        loan.checkout_date = checkout_date
        loan.approval_date = checkout_date
        loan.return_date = return_date
        loan.request_date = checkout_date or datetime.utcnow()

        if return_date:
            loan.status = models.LoanStatusEnum.RETURNED
            asset.status = models.AssetStatusEnum.AVAILABLE
        else:
            loan.status = models.LoanStatusEnum.CHECKED_OUT
            asset.status = models.AssetStatusEnum.LOANED

        if is_new:
            db.add(loan)
            created += 1
        else:
            updated += 1

    db.flush()
    return {"created": created, "updated": updated, "skipped_no_asset": skipped_no_asset}


def main():
    if not APP_ID or not ACCESS_KEY:
        logger.error("Faltan APPSHEET_APP_ID / APPSHEET_ACCESS_KEY en backend/.env")
        sys.exit(1)

    logger.info("Creando/verificando esquema de base de datos...")
    Base.metadata.create_all(bind=engine)

    logger.info("Descargando tabla 'BD' (activos) desde AppSheet...")
    bd_rows = fetch_table("BD")
    logger.info("Recibidos %d registros de activos.", len(bd_rows))

    logger.info("Descargando tabla 'Préstamos' desde AppSheet...")
    loan_rows = fetch_table("Préstamos")
    logger.info("Recibidos %d registros de préstamos.", len(loan_rows))

    db = SessionLocal()
    try:
        asset_stats = import_assets(db, bd_rows)
        db.commit()
        logger.info("Activos -> creados: %d, actualizados: %d, sin código (omitidos): %d",
                    asset_stats["created"], asset_stats["updated"], asset_stats["skipped"])

        loan_stats = import_loans(db, loan_rows)
        db.commit()
        logger.info("Préstamos -> creados: %d, actualizados: %d, sin activo asociado (omitidos): %d",
                    loan_stats["created"], loan_stats["updated"], loan_stats["skipped_no_asset"])

        total_assets = db.query(models.Asset).count()
        total_loans = db.query(models.Loan).count()
        total_users = db.query(models.User).count()
        logger.info("Totales en base de datos -> activos: %d, préstamos: %d, usuarios: %d",
                    total_assets, total_loans, total_users)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    logger.info("Importación finalizada correctamente.")


if __name__ == "__main__":
    main()
