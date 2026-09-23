from database import SessionLocal
import models
from sqlalchemy import text

db = SessionLocal()
with db.connection() as conn:
    # Update users
    conn.execute(text("UPDATE users SET photo_url = NULL WHERE photo_url LIKE '%iphfbavrhduilktwueln%';"))
    # Update assets
    conn.execute(text("UPDATE assets SET photo_url = NULL WHERE photo_url LIKE '%iphfbavrhduilktwueln%';"))
    conn.commit()
    print("Old dead URLs cleared!")
db.close()
