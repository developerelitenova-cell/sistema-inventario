import pytest
from services.asset_classifier import classify_asset, _normalize
from models import CategoryEnum

def test_normalize():
    assert _normalize("  Cámara   Canon ") == "camara canon"
    assert _normalize("") == ""

def test_classify_asset_computadores():
    assert classify_asset("Laptop Thinkpad", "Lenovo") == CategoryEnum.COMPUTADORES
    assert classify_asset("Macbook Pro 16", "") == CategoryEnum.COMPUTADORES
    assert classify_asset("", "Imac") == CategoryEnum.COMPUTADORES

def test_classify_asset_camaras():
    assert classify_asset("Cámara DSLR", "Canon") == CategoryEnum.CAMARAS
    assert classify_asset("GoPro", "") == CategoryEnum.CAMARAS

def test_classify_asset_microfonos():
    assert classify_asset("Micrófono", "Shure") == CategoryEnum.MICROFONOS

def test_classify_asset_audio():
    assert classify_asset("Parlante Bluetooth", "Bose") == CategoryEnum.AUDIO
    assert classify_asset("Airpods Pro", "Apple") == CategoryEnum.AUDIO

def test_classify_asset_tripodes():
    assert classify_asset("Trípode para cámara", "Sony") == CategoryEnum.TRIPODES

def test_classify_asset_cables():
    assert classify_asset("Cable HDMI", "AmazonBasics") == CategoryEnum.CABLES

def test_classify_asset_impresoras():
    assert classify_asset("Impresora multifuncional", "HP") == CategoryEnum.IMPRESORAS

def test_classify_asset_proyectores():
    assert classify_asset("Proyector 4K", "Epson") == CategoryEnum.PROYECTORES

def test_classify_asset_celulares():
    assert classify_asset("Celular", "iPhone 13") == CategoryEnum.CELULARES

def test_classify_asset_tablets():
    assert classify_asset("iPad Air", "Apple") == CategoryEnum.TABLETS

def test_classify_asset_telefono():
    assert classify_asset("Teléfono fijo", "Panasonic") == CategoryEnum.TELEFONO

def test_classify_asset_general_fallback():
    assert classify_asset("Algo sin categoria", "Desconocido") == CategoryEnum.OTROS
    assert classify_asset(None, None) == CategoryEnum.OTROS
    assert classify_asset("", "") == CategoryEnum.OTROS
