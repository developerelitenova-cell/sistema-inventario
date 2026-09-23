"""
Clasifica un activo en una categoría (basadas en la hoja
"Elite_Nutrition_Categorias_por_Cargo") a partir de su descripción y marca/modelo.

Es una heurística por palabras clave: no hay ningún campo de categoría en el
origen (AppSheet), así que se infiere del texto libre. Se usa tanto para
estimar valor de referencia (Fase 3) como para filtrar qué puede pedir cada
cargo (Fase 8).
"""
import re
import unicodedata

from models import CategoryEnum

# Orden importa: las reglas más específicas van primero para evitar falsos
# positivos (ej. "cable HDMI de cámara" debe caer en Cables, no en Cámaras).
_RULES: list[tuple[CategoryEnum, list[str]]] = [
    (CategoryEnum.CABLES, [
        "cable", "cargador", "adaptador", "hdmi", "cable usb", "rj45", "xlr",
        "multitoma", "power group", "cooler pad",
    ]),
    (CategoryEnum.TRIPODES, [
        "tripode", "gimbal", "brazo articulado", "soporte de camara", "estabilizador",
    ]),
    (CategoryEnum.MICROFONOS, [
        "microfono", "micro inalambrico", "lavalier", "shure", "condensador",
    ]),
    (CategoryEnum.AUDIO, [
        "parlante", "altavoz", "bocina", "mezclador", "interfaz de audio",
        "monitor de audio", "speaker", "audifono", "diadema", "airpods", "bafle",
    ]),
    (CategoryEnum.CAMARAS, [
        "camara", "gopro", "mirrorless", "reflex", "dji", "webcam", "videocamara",
    ]),
    (CategoryEnum.PROYECTORES, [
        "proyector", "pantalla de proyeccion", "video beam", "videobeam",
    ]),
    (CategoryEnum.IMPRESORAS, [
        "impresora", "scanner", "multifuncional", "xprinter",
    ]),
    (CategoryEnum.TABLETS, [
        "tablet", "ipad",
    ]),
    (CategoryEnum.CELULARES, [
        "celular", "iphone", "smartphone", "galaxy", "redmi", "xiaomi", "motorola g",
    ]),
    (CategoryEnum.TELEFONO, [
        "telefono de escritorio", "extension telefonica", "telefono ip", "telefono fijo",
    ]),
    (CategoryEnum.COMPUTADORES, [
        "portatil", "laptop", "computador", "macbook", "desktop", "imac",
        "monitor", "cpu", "todo en uno", "pc de escritorio",
        "teclado", "mouse", "mini teclado",
    ]),
]


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.lower()).strip()


from typing import Optional
def classify_asset(description: Optional[str], brand_model: Optional[str]) -> CategoryEnum:
    combined = _normalize(f"{description or ''} {brand_model or ''}")
    for category, keywords in _RULES:
        if any(keyword in combined for keyword in keywords):
            return category
    return CategoryEnum.OTROS
