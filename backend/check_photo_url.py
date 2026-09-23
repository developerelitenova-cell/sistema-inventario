from database import SessionLocal
import models
db = SessionLocal()
users = db.query(models.User).all()
for u in users:
    print(repr(u.photo_url))
db.close()
