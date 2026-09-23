from time_util import get_colombia_time
"""
Calculadora de depreciación en línea recta.

Solo es calculable cuando el activo tiene `purchase_price` y `purchase_date`
cargados manualmente (AppSheet nunca tuvo esos datos). La vida útil por
categoría es una tabla de referencia, ajustable si la empresa define otra
política contable.
"""
from datetime import datetime

import models

USEFUL_LIFE_YEARS: dict["models.CategoryEnum", int] = {
    models.CategoryEnum.COMPUTADORES: 3,
    models.CategoryEnum.CELULARES: 2,
    models.CategoryEnum.TABLETS: 3,
    models.CategoryEnum.CAMARAS: 5,
    models.CategoryEnum.MICROFONOS: 5,
    models.CategoryEnum.AUDIO: 5,
    models.CategoryEnum.TRIPODES: 8,
    models.CategoryEnum.TELEFONO: 5,
    models.CategoryEnum.IMPRESORAS: 5,
    models.CategoryEnum.PROYECTORES: 5,
    models.CategoryEnum.CABLES: 3,
    models.CategoryEnum.OTROS: 5,
}
_DEFAULT_USEFUL_LIFE = 5


def calculate_depreciation(asset: "models.Asset") -> dict:
    if not asset.purchase_price or not asset.purchase_date:
        return {
            "computable": False,
            "reason": "Falta precio y/o fecha de compra registrados manualmente.",
            "useful_life_years": None,
            "book_value": None,
            "accumulated_depreciation": None,
            "percent_depreciated": None,
        }

    useful_life = USEFUL_LIFE_YEARS.get(asset.category, _DEFAULT_USEFUL_LIFE)
    days_elapsed = (get_colombia_time() - asset.purchase_date).days
    total_days = useful_life * 365
    fraction = min(max(days_elapsed / total_days, 0), 1) if total_days > 0 else 1
    book_value = asset.purchase_price * (1 - fraction)

    return {
        "computable": True,
        "reason": None,
        "useful_life_years": useful_life,
        "book_value": round(book_value, 2),
        "accumulated_depreciation": round(asset.purchase_price - book_value, 2),
        "percent_depreciated": round(fraction * 100, 1),
    }
