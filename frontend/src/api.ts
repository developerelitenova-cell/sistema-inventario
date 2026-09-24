import { getPassword } from './auth';
import { getToken } from './session';

const API_URL = 'https://sistema-inventario-kxdc.onrender.com';

export type AssetStatus = 'available' | 'loaned' | 'maintenance' | 'assigned' | 'pending_registration';

export const STATUS_LABELS: Record<AssetStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestado',
  maintenance: 'Mantenimiento',
  assigned: 'Asignado',
  pending_registration: 'Pendiente de registro',
};
export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned';
export type Role = 'admin' | 'encargado' | 'salida' | 'empleado';
export type Module = string;
export type InventoryType = 'activos' | 'publicitario' | 'muebles';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador', encargado: 'Encargado', salida: 'Personal de Salida', empleado: 'Empleado',
};
export type Category =
  | 'computadores' | 'celulares' | 'tablets' | 'camaras' | 'microfonos'
  | 'audio' | 'tripodes' | 'telefono' | 'impresoras' | 'proyectores' | 'cables' | 'otros';
export type ValueSource = 'manual' | 'estimado' | 'desconocido';

export const formatCOP = (amount: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

// Áreas fijas por bodega (definidas por el negocio, no administrables por ahora).
// Futuro Pro tiene su propia lista; el resto de las bodegas comparten esa misma
// lista base más "Marca Personal" y "Pentágono".
const COMMON_AREAS = [
  'Contabilidad - Tesorería',
  'Gestión Humana',
  'Bodega',
  'Comerciales',
  'Gerencia',
  'Tecnología',
  'Creativos',
  'Producción',
];
const NON_FUTUPRO_EXTRA_AREAS = ['Marca Personal', 'Pentágono'];

export const getAreaOptions = (moduleKey: string): string[] =>
  moduleKey === 'futupro' ? COMMON_AREAS : [...COMMON_AREAS, ...NON_FUTUPRO_EXTRA_AREAS];

export const CATEGORY_LABELS: Record<Category, string> = {
  computadores: 'Computadores', celulares: 'Celulares', tablets: 'Tablets',
  camaras: 'Cámaras', microfonos: 'Micrófonos', audio: 'Audio', tripodes: 'Trípodes',
  telefono: 'Teléfono', impresoras: 'Impresoras', proyectores: 'Proyectores',
  cables: 'Cables', otros: 'Otros',
};

export const INVENTORY_TYPE_LABELS: Record<InventoryType, string> = {
  activos: 'Activos',
  publicitario: 'Inv. Publicitario',
  muebles: 'Inv. Muebles',
};

export interface AccessoryItem {
  name: string;
  is_linked_asset?: boolean;
  linked_asset_code?: string | null;
}

export interface Asset {
  id: number;
  unique_code: string;
  description: string | null;
  brand_model: string | null;
  photo_url: string | null;
  status: AssetStatus;
  qr_data: string;
  module: Module;
  area: string | null;
  responsible_name: string | null;
  value: number | null;
  accessories: AccessoryItem[];
  observations: string | null;
  appsheet_photo_ref: string | null;
  inventory_type: InventoryType;
  category: Category | null;
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_value: number | null;
  value_source: ValueSource;
}

export interface Warehouse {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  document_id: string;
  photo_url: string | null;
  digital_signature_url: string | null;
  role: Role;
  warehouses: Warehouse[];
  cargo: string | null;
}

/** Admin maestro = rol admin sin bodegas asignadas (ve/gestiona todo).
 * Un admin CON bodegas asignadas queda acotado a esas bodegas. */
export const isMasterAdmin = (user: User | null | undefined): boolean =>
  !!user && user.role === 'admin' && user.warehouses.length === 0;

export interface RolePermission {
  id: number;
  cargo: string;
  allowed_categories: string;
}

export interface Loan {
  id: number;
  asset_id: number;
  borrower_id: number;
  approver_id: number | null;
  reason: string | null;
  status: LoanStatus;
  request_date: string;
  approval_date: string | null;
  checkout_date: string | null;
  return_date: string | null;
  observations: string | null;
  condition_status: string | null;
  security_authorization: string | null;
  borrowed_accessories?: AccessoryItem[] | null;
  asset: Asset;
  borrower: User;
  approver: User | null;
}

export interface VerificationResult {
  asset_code: string;
  asset_description: string;
  status: AssetStatus;
  is_authorized_to_leave: boolean;
  loan_status: LoanStatus | null;
  loan_id: number | null;
  borrower_name: string | null;
  borrower_photo: string | null;
  borrower_document_id: string | null;
  borrower_signature: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-App-Password': getPassword(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Error ${res.status} al llamar ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const pingAuth = () => request<{status: string}>('/ping-auth');

export const estimateAssetValueWithAI = (photoDataUrl: string) => 
  request<{ description: string, brand_model: string, estimated_price_cop: number | null }>('/api/assets/estimate', {
    method: 'POST',
    body: JSON.stringify({ photo_data_url: photoDataUrl }),
  });

export interface AuthResponse {
  token: string;
  user: User;
  generated_password: string | null;
}

export const registerUser = (payload: {
  full_name: string;
  document_id: string;
  email: string;
  photo_url?: string;
  digital_signature_url?: string;
}) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) });

export const login = (email: string, password: string) =>
  request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = () => request<User>('/auth/me');

export const changePassword = (payload: { current_password: string; new_password: string }) =>
  request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });

export const logoutApi = () =>
  request<{ message: string }>('/auth/logout', { method: 'POST' }).catch(() => null);

export const getAssets = (module?: Module) =>
  request<Asset[]>(`/assets/${module ? `?module=${module}` : ''}`);

export interface AssetAvailability {
  available_count: number;
  busy_count: number;
  busy_areas: string[];
}

export const getAssetAvailability = (category: Category) =>
  request<AssetAvailability>(`/assets/availability?category=${category}`);

export interface AssetCreateInput {
  unique_code: string;
  description: string;
  brand_model: string;
  photo_url?: string;
  module: Module;
  area?: string;
  responsible_name?: string;
  accessories?: AccessoryItem[];
  observations?: string;
  inventory_type?: InventoryType;
  category?: Category;
  purchase_price?: number;
  purchase_date?: string;
}

export const createAsset = (payload: AssetCreateInput) =>
  request<Asset>('/assets/', { method: 'POST', body: JSON.stringify(payload) });

export interface AssetBatchGenerateInput {
  module: Module;
  prefix: string;
  quantity: number;
  start_number?: number;
}

export const batchGenerateAssets = (payload: AssetBatchGenerateInput) =>
  request<Asset[]>('/assets/batch-generate', { method: 'POST', body: JSON.stringify(payload) });

export const getAssetByCode = (code: string) =>
  request<Asset>(`/assets/by-code/${encodeURIComponent(code)}`);

export interface UnusedAsset {
  id: number;
  unique_code: string;
  description: string;
  brand_model: string;
  module: Module;
  area: string | null;
  days_since_last_use: number | null;
  estimated_value: number | null;
  purchase_price: number | null;
}

export const getUnusedAssets = (module?: Module) =>
  request<UnusedAsset[]>(`/assets/unused${module ? `?module=${module}` : ''}`);

export type AssetUpdate = Partial<{
  description: string;
  brand_model: string;
  status: AssetStatus;
  module: Module;
  area: string;
  responsible_name: string;
  value: number;
  accessories: AccessoryItem[];
  observations: string;
  inventory_type: InventoryType;
  category: Category;
  purchase_price: number;
  purchase_date: string;
}>;

export const updateAsset = (assetId: number, update: AssetUpdate) =>
  request<Asset>(`/assets/${assetId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  });

export interface Depreciation {
  computable: boolean;
  reason: string | null;
  useful_life_years: number | null;
  book_value: number | null;
  accumulated_depreciation: number | null;
  percent_depreciated: number | null;
}

export const getAssetDepreciation = (assetId: number) =>
  request<Depreciation>(`/assets/${assetId}/depreciation`);

export const uploadAssetPhoto = async (assetId: number, file: File): Promise<Asset> => {
  const formData = new FormData();
  formData.append('photo', file);
  const token = getToken();
  const res = await fetch(`${API_URL}/assets/${assetId}/photo`, {
    method: 'POST',
    headers: {
      'X-App-Password': getPassword(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Error ${res.status} al subir la foto`);
  }
  return res.json();
};

export const verifyAsset = (code: string) =>
  request<VerificationResult>(`/assets/verify/${encodeURIComponent(code)}`);

export const getLoans = (statusFilter?: LoanStatus) =>
  request<Loan[]>(`/loans/${statusFilter ? `?status_filter=${statusFilter}` : ''}`);

export const getLoan = (loanId: number) =>
  request<Loan>(`/loans/${loanId}`);

export const getUsers = () => request<User[]>('/users/');

export const updateUser = (userId: number, update: Partial<{ cargo: string; role: Role; warehouse_keys: string[] }>) =>
  request<User>(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(update) });

export interface UserCreateInput {
  username: string;
  full_name: string;
  email?: string;
  document_id: string;
  photo_url?: string;
  digital_signature_url?: string;
  role: Role;
  cargo?: string;
  warehouse_keys: string[];
}

export const createUser = (payload: UserCreateInput) =>
  request<User>('/users/', { method: 'POST', body: JSON.stringify(payload) });

export const deleteUser = (userId: number) =>
  request<void>(`/users/${userId}`, { method: 'DELETE' });

export const getRolePermissions = () => request<RolePermission[]>('/role-permissions/');

export const getWarehouses = () => request<Warehouse[]>('/warehouses/');

export const createWarehouse = (payload: { key: string; name: string }) =>
  request<Warehouse>('/warehouses/', { method: 'POST', body: JSON.stringify(payload) });

export const updateWarehouse = (id: number, payload: Partial<{ name: string; is_active: boolean }>) =>
  request<Warehouse>(`/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const resetUserPassword = (userId: number) =>
  request<{ message: string; new_password: string }>(`/users/${userId}/reset-password`, { method: 'POST' });

export const approveLoan = (loanId: number, approve: boolean, requiresExitPass?: boolean) =>
  request<Loan>(`/loans/${loanId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved: approve, requires_exit_pass: requiresExitPass }),
  });

export const requestLoan = (assetId: number, reason: string) =>
  request<Loan>('/loans/request', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, reason }),
  });

export const directLoan = (assetId: number, borrowerId: number, reason: string, requiresExitPass?: boolean) =>
  request<Loan>('/loans/direct', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, borrower_id: borrowerId, reason, requires_exit_pass: requiresExitPass }),
  });

export const checkoutLoanSecurity = (loanId: number, securitySignatureBase64: string, borrowedAccessories?: AccessoryItem[]) =>
  request<Loan>(`/loans/${loanId}/checkout-security`, {
    method: 'POST',
    body: JSON.stringify({ security_signature_base64: securitySignatureBase64, borrowed_accessories: borrowedAccessories }),
  });

export const returnLoan = (loanId: number, details?: { observations?: string; condition_status?: string }) =>
  request<Loan>(`/loans/${loanId}/return`, {
    method: 'POST',
    body: JSON.stringify(details || {}),
  });

export interface AssetHolderInfo {
  type: 'assignment' | 'loan';
  user: User;
  since: string;
  notes?: string;
}

export const getAssetHolder = (assetId: number) =>
  request<AssetHolderInfo>(`/assets/${assetId}/holder`, { method: 'GET' });

export const returnAsset = (assetId: number, details?: { observations?: string; condition_status?: string }) =>
  request<Loan>(`/assets/${assetId}/return`, {
    method: 'POST',
    body: JSON.stringify(details || {}),
  });

export type AssignmentStatus = 'active' | 'expired' | 'revoked';

export interface Assignment {
  id: number;
  asset_id: number;
  user_id: number;
  authorized_by_id: number | null;
  start_date: string;
  expiration_date: string;
  status: AssignmentStatus;
  notes: string | null;
  asset: Asset;
  user: User;
  authorized_by: User | null;
}

export const getAssignments = (statusFilter?: AssignmentStatus) =>
  request<Assignment[]>(`/assignments/${statusFilter ? `?status_filter=${statusFilter}` : ''}`);

export const createAssignment = (assetId: number, userId: number, authorizedById: number | null, durationDays: number, notes: string, securityAuthorization: string | null = null) =>
  request<Assignment>('/assignments/', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, user_id: userId, authorized_by_id: authorizedById, duration_days: durationDays, notes, security_authorization: securityAuthorization }),
  });

export const renewAssignment = (assignmentId: number, durationDays: number) =>
  request<Assignment>(`/assignments/${assignmentId}/renew?duration_days=${durationDays}`, { method: 'POST' });

export const revokeAssignment = (assignmentId: number) =>
  request<Assignment>(`/assignments/${assignmentId}/revoke`, { method: 'POST' });

export type AssetRequestStatus = 'pending' | 'assigned' | 'rejected';

export interface AssetRequest {
  id: number;
  requester_id: number;
  module: Module | null;
  category_requested: Category | null;
  description: string;
  status: AssetRequestStatus;
  reviewed_by_id: number | null;
  resulting_loan_id: number | null;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  requester: User;
  reviewed_by: User | null;
  comments?: RequestComment[];
}

export const createAssetRequest = (categoryRequested: Category | undefined, description: string, module?: string) =>
  request<AssetRequest>('/asset-requests/', {
    method: 'POST',
    body: JSON.stringify({ category_requested: categoryRequested, description, module }),
  });

export const getMyAssetRequests = () => request<AssetRequest[]>('/asset-requests/mine');

export const getAssetRequests = (statusFilter?: AssetRequestStatus) =>
  request<AssetRequest[]>(`/asset-requests/${statusFilter ? `?status_filter=${statusFilter}` : ''}`);

export const assignAssetRequest = (requestId: number, assetId: number, notes?: string, requiresExitPass?: boolean) =>
  request<AssetRequest>(`/asset-requests/${requestId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, notes, requires_exit_pass: requiresExitPass }),
  });

export const rejectAssetRequest = (requestId: number, notes?: string) =>
  request<AssetRequest>(`/asset-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });

export interface RequestComment {
  id: number;
  asset_request_id: number;
  message: string;
  created_at: string;
  author: User;
}

export const getRequestComments = (requestId: number) =>
  request<RequestComment[]>(`/asset-requests/${requestId}/comments`);

export const addRequestComment = (requestId: number, message: string) =>
  request<RequestComment>(`/asset-requests/${requestId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

export interface ActivityLog {
  id: number;
  action: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
  actor: User | null;
}

export const getActivityLogs = (params?: { entity_type?: string; actor_id?: number; limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (params?.entity_type) query.set('entity_type', params.entity_type);
  if (params?.actor_id) query.set('actor_id', String(params.actor_id));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<ActivityLog[]>(`/activity-logs/${qs ? `?${qs}` : ''}`);
};
