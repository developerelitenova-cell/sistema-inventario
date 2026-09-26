import sqlite3
from sqlalchemy import create_engine
import os
import psycopg2
from dotenv import load_dotenv
load_dotenv()
try:
    conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
    cur = conn.cursor()
    cur.execute("ALTER TABLE asset_assignments ADD COLUMN is_accepted BOOLEAN DEFAULT FALSE;")
    conn.commit()
    print("Migrated successfully")
except Exception as e:
    print(f"Error or already migrated: {e}")
