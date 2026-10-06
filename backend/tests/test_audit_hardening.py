import pytest
from fastapi.testclient import TestClient
from models import User, RoleEnum, Asset, AssetStatusEnum, Loan, LoanStatusEnum
from services.auth import create_token, hash_password


def test_corporate_email_domain_validation(client: TestClient):
    # Intentar registrar con dominio comercial no corporativo (@gmail.com) -> debe ser rechazado
    res_gmail = client.post("/auth/register", json={
        "document_id": "777001",
        "full_name": "Infiltrado Gmail",
        "email": "test@gmail.com",
    })
    assert res_gmail.status_code == 400
    assert "Solo se permiten correos corporativos oficiales" in res_gmail.json()["detail"]

    # Intentar registrar con dominio corporativo oficial Elite -> debe ser admitido
    res_corp = client.post("/auth/register", json={
        "document_id": "777002",
        "full_name": "Funcionario Elite",
        "email": "funcionario@elitenutrition.com.co",
    })
    assert res_corp.status_code == 200
    assert res_corp.json()["user"]["email"] == "funcionario@elitenutrition.com.co"

    # Intentar registrar con dominio corporativo oficial FutuPro -> debe ser admitido
    res_futu = client.post("/auth/register", json={
        "document_id": "777004",
        "full_name": "Funcionario FutuPro",
        "email": "operaciones@futupro.com",
    })
    assert res_futu.status_code == 200
    assert res_futu.json()["user"]["email"] == "operaciones@futupro.com"


def test_password_complexity_enforcement(client: TestClient, db_session):
    user = User(
        username="complex_pwd_user",
        full_name="Complex Pwd User",
        email="complex@elitenutrition.com.co",
        document_id="777003",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("OldPassword!123"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    token = create_token(db_session, user)

    # Intento de cambiar contraseña por una simple sin dígitos o símbolos especiales
    res_weak = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword!123", "new_password": "sololetrasgrandesy"}
    )
    assert res_weak.status_code == 400
    assert "número o símbolo especial" in res_weak.json()["detail"]

    # Intento con contraseña robusta cumpliendo la política
    res_strong = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword!123", "new_password": "NewStrongP@ss2026"}
    )
    assert res_strong.status_code == 200
    assert res_strong.json()["message"] == "Contraseña actualizada exitosamente"


def test_user_soft_delete_and_login_blocking(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    target_user = User(
        username="target_user",
        full_name="Target User",
        email="target@elitenutrition.com.co",
        document_id="777004",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23"),
        is_active=True,
    )
    db_session.add(target_user)
    db_session.commit()
    target_id = target_user.id

    # Admin ejecuta DELETE /users/{id}
    res_del = client.delete(
        f"/users/{target_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_del.status_code == 204

    # Verificar que el usuario NO fue eliminado físicamente de la base de datos (Soft Delete)
    db_session.expire_all()
    queried_user = db_session.query(User).filter(User.id == target_id).first()
    assert queried_user is not None
    assert queried_user.is_active is False

    # El usuario inactivo intenta iniciar sesión -> debe ser bloqueado con 403
    res_login = client.post("/auth/login", json={
        "email": "target@elitenutrition.com.co",
        "password": "MySecretPass!23",
    })
    assert res_login.status_code == 403
    assert "deshabilitado" in res_login.json()["detail"]

    # Admin reactiva al usuario mediante PATCH /users/{id}/toggle-active
    res_toggle = client.patch(
        f"/users/{target_id}/toggle-active",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_active"] is True


def test_cannot_deactivate_user_with_active_loan(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    borrower = User(
        username="borrower_user",
        full_name="Borrower User",
        email="borrower@elitenutrition.com.co",
        document_id="777005",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23"),
        is_active=True,
    )
    asset = Asset(
        unique_code="LOAN-ASSET-01",
        description="Equipo en Préstamo",
        module="test_module",
        status=AssetStatusEnum.LOANED,
        is_active=True,
    )
    db_session.add_all([borrower, asset])
    db_session.commit()

    loan = Loan(
        asset_id=asset.id,
        borrower_id=borrower.id,
        status=LoanStatusEnum.CHECKED_OUT,
        reason="Préstamo operativo",
    )
    db_session.add(loan)
    db_session.commit()

    # Intento de desactivar al usuario con préstamo activo -> Bloqueo transaccional
    res_del = client.delete(
        f"/users/{borrower.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_del.status_code == 400
    assert "préstamo(s) activo(s)" in res_del.json()["detail"]


def test_asset_sanitization_soft_delete_and_restore(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    # Crear activo con espacios alrededor y minúsculas -> debe sanitizarse a mayúsculas sin espacios
    res_create = client.post(
        "/assets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "unique_code": "   sanit-001   ",
            "description": "Activo Prueba Sanitización",
            "brand_model": "Elite Brand",
            "module": "test_module",
            "status": "available",
        }
    )
    assert res_create.status_code == 200
    asset_id = res_create.json()["id"]
    assert res_create.json()["unique_code"] == "SANIT-001"

    # Eliminar activo (Soft delete)
    res_del = client.delete(
        f"/assets/{asset_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_del.status_code == 204

    # Por defecto en GET /assets/, no debe listarse
    res_list = client.get("/assets/?module=test_module", headers={"Authorization": f"Bearer {admin_token}"})
    assert all(a["id"] != asset_id for a in res_list.json())

    # Con include_inactive=true, sí debe aparecer
    res_list_all = client.get("/assets/?module=test_module&include_inactive=true", headers={"Authorization": f"Bearer {admin_token}"})
    assert any(a["id"] == asset_id for a in res_list_all.json())

    # Restaurar activo
    res_restore = client.patch(
        f"/assets/{asset_id}/restore",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_restore.status_code == 200
    assert res_restore.json()["is_active"] is True


def test_asset_state_machine_enforcement(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    asset = Asset(
        unique_code="FSM-001",
        description="Equipo FSM",
        module="test_module",
        status=AssetStatusEnum.AVAILABLE,
        is_active=True,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Prohibido pasar manualmente a 'assigned' desde actualización directa
    res_illegal_assign = client.put(
        f"/assets/{asset.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "assigned"}
    )
    assert res_illegal_assign.status_code == 400
    assert "módulo de Asignaciones" in res_illegal_assign.json()["detail"]

    # 2. Pasar a mantenimiento desde available -> permitido
    res_maint = client.put(
        f"/assets/{asset.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "maintenance"}
    )
    assert res_maint.status_code == 200
    assert res_maint.json()["status"] == "maintenance"

    # 3. Prohibido pasar a pending_registration una vez registrado
    res_pending = client.put(
        f"/assets/{asset.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "pending_registration"}
    )
    assert res_pending.status_code == 400
    assert "No se puede regresar al estado 'Pendiente de Registro'" in res_pending.json()["detail"]


def test_asset_search_and_query_params(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    a1 = Asset(
        unique_code="SRCH-001",
        description="Laptop Dell XPS",
        brand_model="Dell",
        module="test_module",
        status=AssetStatusEnum.AVAILABLE,
        is_active=True,
    )
    a2 = Asset(
        unique_code="SRCH-002",
        description="Monitor Samsung 27",
        brand_model="Samsung",
        module="test_module",
        status=AssetStatusEnum.MAINTENANCE,
        is_active=True,
    )
    db_session.add_all([a1, a2])
    db_session.commit()

    # Búsqueda por texto "Dell"
    res_dell = client.get("/assets/?module=test_module&search=Dell", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_dell.status_code == 200
    assert len(res_dell.json()) == 1
    assert res_dell.json()[0]["unique_code"] == "SRCH-001"

    # Filtro por estado "maintenance"
    res_maint = client.get("/assets/?module=test_module&status=maintenance", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_maint.status_code == 200
    assert any(a["unique_code"] == "SRCH-002" for a in res_maint.json())


def test_activity_log_filters(client: TestClient, admin_user, db_session):
    admin_token = create_token(db_session, admin_user)

    # Consultar activity logs con filtro de búsqueda
    res_logs = client.get("/activity-logs/?search=inició", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_logs.status_code == 200
    assert isinstance(res_logs.json(), list)
