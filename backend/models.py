from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Enum, Boolean, Table
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from database import Base

class RoleEnum(enum.Enum):
    ADMIN = "admin"
    ENCARGADO = "encargado"
    SALIDA = "salida"
    EMPLEADO = "empleado"

class AssetStatusEnum(enum.Enum):
    AVAILABLE = "available"
    LOANED = "loaned"
    MAINTENANCE = "maintenance"
    ASSIGNED = "assigned"
    PENDING_REGISTRATION = "pending_registration"

class AssignmentStatusEnum(enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"

class CategoryEnum(enum.Enum):
    COMPUTADORES = "computadores"
    CELULARES = "celulares"
    TABLETS = "tablets"
    CAMARAS = "camaras"
    MICROFONOS = "microfonos"
    AUDIO = "audio"
    TRIPODES = "tripodes"
    TELEFONO = "telefono"
    IMPRESORAS = "impresoras"
    PROYECTORES = "proyectores"
    CABLES = "cables"
    OTROS = "otros"

class InventoryTypeEnum(enum.Enum):
    ACTIVOS = "activos"
    PUBLICITARIO = "publicitario"
    MUEBLES = "muebles"

class ValueSourceEnum(enum.Enum):
    MANUAL = "manual"
    ESTIMADO = "estimado"
    DESCONOCIDO = "desconocido"

class LoanStatusEnum(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHECKED_OUT = "checked_out"
    RETURNED = "returned"

class RequestStatusEnum(enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    REJECTED = "rejected"

user_warehouses = Table(
    "user_warehouses",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("warehouse_id", Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), primary_key=True),
)


class Warehouse(Base):
    """Bodega/módulo administrable en runtime (reemplaza el antiguo ModuleEnum
    fijo). `key` es el slug inmutable usado como referencia en assets/usuarios;
    `name` es la etiqueta editable desde el admin."""
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True, nullable=True)
    document_id = Column(String, unique=True, index=True)
    photo_url = Column(String, nullable=True)
    digital_signature_url = Column(String, nullable=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.EMPLEADO)

    warehouses = relationship("Warehouse", secondary=user_warehouses, backref="users")
    cargo = Column(String, nullable=True, index=True)

    password_hash = Column(String, nullable=True)

    loans_borrowed = relationship("Loan", foreign_keys='Loan.borrower_id', back_populates="borrower")
    loans_approved = relationship("Loan", foreign_keys='Loan.approver_id', back_populates="approver")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    unique_code = Column(String, unique=True, index=True)
    description = Column(String)
    brand_model = Column(String)
    photo_url = Column(String, nullable=True)
    status = Column(Enum(AssetStatusEnum), default=AssetStatusEnum.AVAILABLE)
    qr_data = Column(String, unique=True, index=True)

    module = Column(String, ForeignKey("warehouses.key"), nullable=False, index=True)

    # Campos importados del catálogo maestro de AppSheet (tabla "BD")
    area = Column(String, nullable=True)
    responsible_name = Column(String, nullable=True)
    value = Column(Float, nullable=True)
    accessory_1 = Column(String, nullable=True)
    accessory_2 = Column(String, nullable=True)
    accessory_3 = Column(String, nullable=True)
    observations = Column(Text, nullable=True)
    appsheet_photo_ref = Column(String, nullable=True)

    # Categorización y valorización (Fase 3)
    inventory_type = Column(Enum(InventoryTypeEnum), default=InventoryTypeEnum.ACTIVOS, index=True)
    category = Column(Enum(CategoryEnum), nullable=True, index=True)
    purchase_price = Column(Float, nullable=True)
    purchase_date = Column(DateTime, nullable=True)
    estimated_value = Column(Float, nullable=True)
    value_source = Column(Enum(ValueSourceEnum), default=ValueSourceEnum.DESCONOCIDO)

    loans = relationship("Loan", back_populates="asset")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    borrower_id = Column(Integer, ForeignKey("users.id"))
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    reason = Column(Text, nullable=True)
    status = Column(Enum(LoanStatusEnum), default=LoanStatusEnum.PENDING)

    request_date = Column(DateTime, default=datetime.utcnow)
    approval_date = Column(DateTime, nullable=True)
    checkout_date = Column(DateTime, nullable=True)
    return_date = Column(DateTime, nullable=True)

    observations = Column(Text, nullable=True)

    # Campos importados del historial de AppSheet (tabla "Préstamos")
    external_id = Column(String, nullable=True, index=True)
    condition_status = Column(String, nullable=True)
    security_authorization = Column(String, nullable=True)
    signature_ref = Column(String, nullable=True)
    security_signature_url = Column(String, nullable=True)  # Pase de Salida de Pentágono

    asset = relationship("Asset", back_populates="loans")
    borrower = relationship("User", foreign_keys=[borrower_id], back_populates="loans_borrowed")
    approver = relationship("User", foreign_keys=[approver_id], back_populates="loans_approved")


class AssetAssignment(Base):
    """Asignación temporal autorizada de un activo a un líder (distinta de un
    préstamo puntual): no tiene checkout/return por uso, sino una vigencia que
    se debe renovar periódicamente."""
    __tablename__ = "asset_assignments"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    authorized_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    start_date = Column(DateTime, default=datetime.utcnow)
    expiration_date = Column(DateTime, nullable=False)
    status = Column(Enum(AssignmentStatusEnum), default=AssignmentStatusEnum.ACTIVE)
    notes = Column(Text, nullable=True)

    asset = relationship("Asset")
    user = relationship("User", foreign_keys=[user_id])
    authorized_by = relationship("User", foreign_keys=[authorized_by_id])


class RolePermission(Base):
    """Categorías de activos permitidas por cargo, sembrado desde la hoja
    'Elite_Nutrition_Categorias_por_Cargo'. `allowed_categories` guarda los
    valores de CategoryEnum separados por coma."""
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    cargo = Column(String, unique=True, index=True)
    allowed_categories = Column(Text)


class AuthToken(Base):
    """Token de sesión emitido en login/registro. Se valida por lookup directo
    (sin JWT) para mantener el modelo de auth simple y revocable."""
    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User")


class AssetRequest(Base):
    """Solicitud de un empleado que describe qué necesita (categoría +
    motivo) sin elegir un activo puntual del catálogo. El encargado/admin la
    revisa y, si corresponde, la convierte en un Loan asignando un activo
    disponible concreto."""
    __tablename__ = "asset_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    module = Column(String, ForeignKey("warehouses.key"), nullable=True)
    category_requested = Column(Enum(CategoryEnum), nullable=True)
    description = Column(Text)
    status = Column(Enum(RequestStatusEnum), default=RequestStatusEnum.PENDING)

    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resulting_loan_id = Column(Integer, ForeignKey("loans.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    requester = relationship("User", foreign_keys=[requester_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    resulting_loan = relationship("Loan")
    comments = relationship("RequestComment", backref="asset_request", order_by="RequestComment.created_at")


class RequestComment(Base):
    """Mensaje de un hilo tipo PQR entre el solicitante y el encargado,
    asociado a una AssetRequest puntual."""
    __tablename__ = "request_comments"

    id = Column(Integer, primary_key=True, index=True)
    asset_request_id = Column(Integer, ForeignKey("asset_requests.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset_request = relationship("AssetRequest")
    author = relationship("User")


class ActivityLog(Base):
    """Registro de auditoría: una entrada legible por cada acción relevante
    ocurrida en el servidor (quién hizo qué, sobre qué entidad)."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, index=True)
    description = Column(Text)
    entity_type = Column(String, nullable=True, index=True)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    actor = relationship("User")
