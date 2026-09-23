from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Check enum values first
    result = db.execute(text("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'assetstatusenum'::regtype"))
    print("Enum values:", [r[0] for r in result])

    # Check current statuses
    result = db.execute(text("SELECT status, COUNT(*) FROM assets GROUP BY status"))
    for r in result:
        print(f"  {r[0]} → {r[1]} activos")

    db.commit()
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
