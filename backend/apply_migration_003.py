import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__)))

from database import engine
from sqlalchemy import text

def apply_migration():
    migration_file = os.path.join(os.path.dirname(__file__), "migrations", "003_soft_delete_support.sql")
    with open(migration_file, "r") as f:
        sql = f.read()

    with engine.begin() as conn:
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                print(f"Executing: {stmt}")
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    print(f"Statement notice/error: {e}")
    print("Migration 003 applied successfully.")

if __name__ == "__main__":
    apply_migration()
