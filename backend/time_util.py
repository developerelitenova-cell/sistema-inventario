from datetime import datetime, timezone

def get_colombia_time():
    """
    Retorna la hora actual en UTC.
    El formateo a hora local (Bogotá/Colombia) se debe realizar en el frontend
    interpretando correctamente la fecha UTC ('Z').
    """
    return datetime.now(timezone.utc)
