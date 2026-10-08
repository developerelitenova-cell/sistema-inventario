import sys
from database import SessionLocal
import models

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == "diseno1@gmail.com").first()
if user:
    user.email = "diseno1@futupro.com"
    db.commit()
    print("ÉXITO: Se actualizó el correo de la usuaria a 'diseno1@futupro.com'.")
else:
    print("No se encontró el usuario 'diseno1@gmail.com'.")
