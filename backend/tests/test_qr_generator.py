import pytest
import base64
from services.qr_generator import generate_qr_base64

def test_generate_qr_base64():
    data = "EN-0001"
    qr_b64 = generate_qr_base64(data)
    
    # Check if it's a valid string
    assert type(qr_b64) is str
    assert len(qr_b64) > 100
    
    # Decode base64 to ensure it's valid PNG
    try:
        decoded = base64.b64decode(qr_b64)
        assert decoded.startswith(b'\x89PNG\r\n\x1a\n')
    except Exception as e:
        pytest.fail(f"Invalid base64 string or not a PNG: {e}")
