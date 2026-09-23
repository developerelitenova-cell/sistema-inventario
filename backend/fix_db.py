import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database import engine
from sqlalchemy import text

def add_borrowed_accessories_column():
    with engine.begin() as conn:
        try:
            # Check if column exists first
            res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='loans' AND column_name='borrowed_accessories'"))
            if not res.fetchone():
                print("Adding borrowed_accessories to loans...")
                conn.execute(text("ALTER TABLE loans ADD COLUMN borrowed_accessories JSONB DEFAULT '[]'::jsonb;"))
                print("Column added successfully.")
            else:
                print("Column borrowed_accessories already exists.")
        except Exception as e:
            print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_borrowed_accessories_column()
