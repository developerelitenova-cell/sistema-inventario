from database import SessionLocal
import models
db = SessionLocal()
users = db.query(models.User).filter(models.User.full_name == "Leidy Johana Cordoba Giraldo").all()
for u in users:
    print(u.photo_url)
db.close()
