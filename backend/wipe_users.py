from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

MASTER_ID = 31  # Administrador Maestro

try:
    # 1. Delete ALL request_comments first (they reference asset_requests)
    db.execute(text("DELETE FROM request_comments"))
    print("✓ request_comments limpiados")

    # 2. Delete ALL asset_requests
    db.execute(text("DELETE FROM asset_requests"))
    print("✓ asset_requests limpiados")

    # 3. Delete ALL loans  
    db.execute(text("DELETE FROM loans"))
    print("✓ loans limpiados")

    # 4. Delete ALL asset_assignments  
    db.execute(text("DELETE FROM asset_assignments"))
    print("✓ asset_assignments limpiados")

    # 5. Delete ALL activity_logs
    db.execute(text("DELETE FROM activity_logs"))
    print("✓ activity_logs limpiados")

    # 6. Delete ALL auth_tokens for non-master
    db.execute(text(f"DELETE FROM auth_tokens WHERE user_id != {MASTER_ID}"))
    print("✓ auth_tokens limpiados")

    # 7. Delete ALL user_warehouses for non-master
    db.execute(text(f"DELETE FROM user_warehouses WHERE user_id != {MASTER_ID}"))
    print("✓ user_warehouses limpiados")

    # 8. Finally delete all users except master
    result = db.execute(text(f"DELETE FROM users WHERE id != {MASTER_ID}"))
    print(f"✓ {result.rowcount} usuarios eliminados")

    # 9. Reset assets status back to available
    db.execute(text("UPDATE assets SET status = 'available' WHERE status IN ('assigned', 'on_loan')"))
    print("✓ Activos devueltos a 'disponible'")

    db.commit()
    print("\n🎉 Limpieza completa. Solo queda: Administrador Maestro (ID=31)")

    # Verify
    remaining = db.execute(text("SELECT id, full_name, role FROM users")).fetchall()
    for r in remaining:
        print(f"  → ID={r[0]} | {r[1]} | {r[2]}")

except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
