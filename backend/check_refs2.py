from database import SessionLocal
import models
from sqlalchemy import inspect

# Check what tables/models exist
inspector = inspect(models)
print("Models:", [name for name, obj in vars(models).items() if hasattr(obj, '__tablename__')])

db = SessionLocal()
users = db.query(models.User).all()
print(f"\nTotal users: {len(users)}")
for u in users:
    print(f"  ID={u.id} | {u.full_name} | role={u.role} | photo={u.photo_url is not None} | sig={getattr(u, 'digital_signature_url', 'N/A')}")
db.close()
