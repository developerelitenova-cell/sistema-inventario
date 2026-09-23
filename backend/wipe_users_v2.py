from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

MASTER_ID = 31  # Administrador Maestro

try:
    # Step 1: Clean all child tables completely
    db.execute(text("DELETE FROM request_comments"))
    print("✓ request_comments")
    
    db.execute(text("DELETE FROM asset_requests"))
    print("✓ asset_requests")
    
    db.execute(text("DELETE FROM loans"))
    print("✓ loans")
    
    db.execute(text("DELETE FROM asset_assignments"))
    print("✓ asset_assignments")
    
    db.execute(text("DELETE FROM activity_logs"))
    print("✓ activity_logs")
    
    db.execute(text(f"DELETE FROM auth_tokens WHERE user_id != {MASTER_ID}"))
    print("✓ auth_tokens")
    
    db.execute(text(f"DELETE FROM user_warehouses WHERE user_id != {MASTER_ID}"))
    print("✓ user_warehouses")
    
    # Step 2: Delete all users except master
    result = db.execute(text(f"DELETE FROM users WHERE id != {MASTER_ID}"))
    print(f"✓ {result.rowcount} usuarios eliminados")
    
    # Step 3: Reset loaned/assigned assets
    db.execute(text("UPDATE assets SET status = 'AVAILABLE' WHERE status IN ('LOANED', 'ASSIGNED')"))
    print("✓ Activos liberados")

    db.commit()
    
    # Verify
    result = db.execute(text("SELECT id, full_name, role FROM users"))
    print("\n🎉 Usuarios restantes:")
    for r in result:
        print(f"  → ID={r[0]} | {r[1]} | {r[2]}")
    
    result = db.execute(text("SELECT status, COUNT(*) FROM assets GROUP BY status"))
    print("\nEstado de activos:")
    for r in result:
        print(f"  {r[0]} → {r[1]}")

except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
