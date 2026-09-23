import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import engine
from sqlalchemy import text

def run_migration():
    migration_path = "backend/migrations/002_dynamic_accessories.sql"
    with open(migration_path, "r") as f:
        sql = f.read()

    with engine.begin() as conn:
        try:
            print("Running migration 002...")
            # We split by semicolon to execute commands individually, or just execute the whole block
            for statement in sql.split(';'):
                statement = statement.strip()
                if statement:
                    conn.execute(text(statement))
            print("Migration completed successfully.")
        except Exception as e:
            print(f"Error running migration: {e}")

run_migration()
