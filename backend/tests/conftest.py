import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import RoleEnum, User, Warehouse

# Configuración de base de datos en memoria para testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(setup_database):
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Sembrar bodega por defecto para tests
    warehouse = Warehouse(key="test_module", name="Test Module")
    session.add(warehouse)
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db_session):
    from services.auth import hash_password
    user = User(
        username="test_user",
        full_name="Test User",
        email="test@example.com",
        document_id="123456",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def admin_user(db_session):
    from services.auth import hash_password
    user = User(
        username="admin_user",
        full_name="Admin User",
        email="admin@example.com",
        document_id="000000",
        role=RoleEnum.ADMIN,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
