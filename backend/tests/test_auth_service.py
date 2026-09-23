import pytest
from services.auth import generate_password, hash_password, verify_password

def test_generate_password():
    password = generate_password()
    assert len(password) >= 12
    assert type(password) is str

def test_hash_password():
    password = "MySecurePassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert len(hashed) > 0

def test_verify_password_success():
    password = "MySecurePassword123"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True

def test_verify_password_failure():
    password = "MySecurePassword123"
    hashed = hash_password(password)
    assert verify_password("WrongPassword123", hashed) is False

def test_verify_password_invalid_hash():
    password = "MySecurePassword123"
    assert verify_password(password, "invalid_hash_string") is False
