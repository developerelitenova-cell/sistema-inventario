from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models import RoleEnum, AssetStatusEnum, LoanStatusEnum, CategoryEnum, ValueSourceEnum, AssignmentStatusEnum, RequestStatusEnum, InventoryTypeEnum

class AccessoryItem(BaseModel):
    name: str
    is_linked_asset: bool = False
    linked_asset_code: Optional[str] = None

class Warehouse(BaseModel):
    id: int
    key: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True

class WarehouseCreate(BaseModel):
    key: str
    name: str

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    document_id: str
    photo_url: Optional[str] = None
    digital_signature_url: Optional[str] = None
    role: RoleEnum
    cargo: Optional[str] = None

class UserCreate(UserBase):
    warehouse_keys: List[str] = []

class User(UserBase):
    id: int
    warehouses: List[Warehouse] = []
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    cargo: Optional[str] = None
    role: Optional[RoleEnum] = None
    warehouse_keys: Optional[List[str]] = None

class RegisterRequest(BaseModel):
    full_name: str
    document_id: str
    email: str
    photo_url: Optional[str] = None
    digital_signature_url: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: User
    generated_password: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class RolePermission(BaseModel):
    id: int
    cargo: str
    allowed_categories: str

    class Config:
        from_attributes = True

class AssetBase(BaseModel):
    unique_code: str
    description: Optional[str] = None
    brand_model: Optional[str] = None
    photo_url: Optional[str] = None
    status: AssetStatusEnum = AssetStatusEnum.AVAILABLE
    qr_data: str
    module: str
    area: Optional[str] = None
    responsible_name: Optional[str] = None
    value: Optional[float] = None
    accessories: List[AccessoryItem] = []
    observations: Optional[str] = None
    appsheet_photo_ref: Optional[str] = None
    inventory_type: InventoryTypeEnum = InventoryTypeEnum.ACTIVOS
    category: Optional[CategoryEnum] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[datetime] = None
    estimated_value: Optional[float] = None
    value_source: ValueSourceEnum = ValueSourceEnum.DESCONOCIDO

class AssetCreate(BaseModel):
    unique_code: str
    description: str
    brand_model: str
    photo_url: Optional[str] = None
    status: AssetStatusEnum = AssetStatusEnum.AVAILABLE
    module: str
    area: Optional[str] = None
    responsible_name: Optional[str] = None
    accessories: List[AccessoryItem] = []
    observations: Optional[str] = None
    inventory_type: Optional[InventoryTypeEnum] = None
    category: Optional[CategoryEnum] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[datetime] = None

class Asset(AssetBase):
    id: int
    class Config:
        from_attributes = True

class AssetBatchGenerate(BaseModel):
    module: str
    prefix: str
    quantity: int
    start_number: Optional[int] = None

class AssetUpdate(BaseModel):
    description: Optional[str] = None
    brand_model: Optional[str] = None
    status: Optional[AssetStatusEnum] = None
    module: Optional[str] = None
    area: Optional[str] = None
    responsible_name: Optional[str] = None
    value: Optional[float] = None
    accessories: Optional[List[AccessoryItem]] = None
    observations: Optional[str] = None
    inventory_type: Optional[InventoryTypeEnum] = None
    category: Optional[CategoryEnum] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[datetime] = None

class LoanBase(BaseModel):
    asset_id: int
    borrower_id: int
    reason: Optional[str] = None
    borrowed_accessories: Optional[List[AccessoryItem]] = None

class LoanCreate(BaseModel):
    asset_id: int
    reason: str

class DirectLoanCreate(BaseModel):
    asset_id: int
    borrower_id: int
    reason: str
    requires_exit_pass: Optional[bool] = None

class Loan(LoanBase):
    id: int
    approver_id: Optional[int] = None
    status: LoanStatusEnum
    request_date: datetime
    approval_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
    observations: Optional[str] = None
    external_id: Optional[str] = None
    condition_status: Optional[str] = None
    security_authorization: Optional[str] = None
    signature_ref: Optional[str] = None
    borrowed_accessories: Optional[List[AccessoryItem]] = None
    security_signature_url: Optional[str] = None

    asset: Asset
    borrower: User
    approver: Optional[User] = None

    class Config:
        from_attributes = True

class LoanApproval(BaseModel):
    approved: bool
    requires_exit_pass: Optional[bool] = None

class LoanReturn(BaseModel):
    observations: Optional[str] = None
    condition_status: Optional[str] = None

class CheckoutRequest(BaseModel):
    observations: Optional[str] = None

class AssignmentCreate(BaseModel):
    asset_id: int
    user_id: int
    authorized_by_id: Optional[int] = None
    duration_days: int = 90
    notes: Optional[str] = None

class Assignment(BaseModel):
    id: int
    asset_id: int
    user_id: int
    authorized_by_id: Optional[int] = None
    start_date: datetime
    expiration_date: datetime
    status: AssignmentStatusEnum
    notes: Optional[str] = None

    asset: Asset
    user: User
    authorized_by: Optional[User] = None

    class Config:
        from_attributes = True

class AssetRequestCreate(BaseModel):
    category_requested: Optional[CategoryEnum] = None
    description: str
    module: Optional[str] = None

class AssetRequestAssign(BaseModel):
    asset_id: int
    notes: Optional[str] = None
    requires_exit_pass: Optional[bool] = None

class AssetRequestReject(BaseModel):
    notes: Optional[str] = None

class AssetRequest(BaseModel):
    id: int
    requester_id: int
    module: Optional[str] = None
    category_requested: Optional[CategoryEnum] = None
    description: str
    status: RequestStatusEnum
    reviewed_by_id: Optional[int] = None
    resulting_loan_id: Optional[int] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None

    requester: User
    reviewed_by: Optional[User] = None
    comments: List["RequestComment"] = []

    class Config:
        from_attributes = True

class AssetAvailability(BaseModel):
    available_count: int
    busy_count: int
    busy_areas: List[str]

class RequestCommentCreate(BaseModel):
    message: str

class RequestComment(BaseModel):
    id: int
    asset_request_id: int
    message: str
    created_at: datetime
    author: User

    class Config:
        from_attributes = True

class ActivityLog(BaseModel):
    id: int
    action: str
    description: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    created_at: datetime
    actor: Optional[User] = None

    class Config:
        from_attributes = True

AssetRequest.model_rebuild()

