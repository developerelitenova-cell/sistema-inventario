import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import engine
from sqlalchemy import text

def check_schema():
    with engine.begin() as conn:
        res = conn.execute(text("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name;"))
        for row in res:
            print(f"{row[0]}.{row[1]}")

check_schema()
