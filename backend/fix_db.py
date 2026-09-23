import sys
import os

from sqlalchemy import text
from database import engine

def fix_nulls():
    with engine.connect() as conn:
        conn.execute(text("UPDATE assets SET inventory_type = 'ACTIVOS' WHERE inventory_type IS NULL;"))
        conn.execute(text("UPDATE assets SET value_source = 'DESCONOCIDO' WHERE value_source IS NULL;"))
        conn.commit()
        print("Database updated successfully.")

if __name__ == "__main__":
    fix_nulls()
