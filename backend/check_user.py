from database import SessionLocal
import models

db = SessionLocal()
users = db.query(models.User).all()
for u in users:
    print(f"User: {u.email}, Role: {u.role}")
db.close()
