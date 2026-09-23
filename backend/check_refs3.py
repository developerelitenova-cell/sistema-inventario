from database import SessionLocal
import models

db = SessionLocal()

# List all users
users = db.query(models.User).all()
print(f"Total users: {len(users)}")
for u in users:
    sig = getattr(u, 'digital_signature_url', None)
    print(f"  ID={u.id} | {u.full_name} | role={u.role} | photo={'YES' if u.photo_url else 'NO'} | sig={'YES' if sig else 'NO'}")

# Check for FK references to users
from sqlalchemy import text
result = db.execute(text("""
    SELECT table_name, column_name 
    FROM information_schema.key_column_usage 
    WHERE constraint_name IN (
        SELECT constraint_name FROM information_schema.referential_constraints 
        WHERE unique_constraint_name IN (
            SELECT constraint_name FROM information_schema.table_constraints 
            WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY'
        )
    )
"""))
print("\nFK references to users table:")
for row in result:
    print(f"  {row[0]}.{row[1]}")

db.close()
