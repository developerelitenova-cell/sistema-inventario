from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Reset the 4 LOANED assets back to AVAILABLE since we deleted all loans
    db.execute(text("UPDATE assets SET status = 'AVAILABLE' WHERE status = 'LOANED'"))
    db.commit()
    print("✓ 4 activos prestados devueltos a AVAILABLE")
    
    # Verify
    result = db.execute(text("SELECT status, COUNT(*) FROM assets GROUP BY status"))
    for r in result:
        print(f"  {r[0]} → {r[1]} activos")
    
    # Verify users
    result = db.execute(text("SELECT id, full_name, role FROM users"))
    print("\nUsuarios restantes:")
    for r in result:
        print(f"  → ID={r[0]} | {r[1]} | {r[2]}")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
