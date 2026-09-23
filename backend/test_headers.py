import requests
from database import SessionLocal
import models
from services.auth import create_token

db = SessionLocal()
user = db.query(models.User).filter(models.User.role == 'ADMIN').first()
token = create_token(db, user)
db.close()

headers = {"Authorization": f"Bearer {token}", "Origin": "https://sistema-inventario-lyart-eta.vercel.app"}
res = requests.get("https://sistema-inventario-kxdc.onrender.com/assets/?module=EE.UU", headers=headers)
print(res.status_code)
print(res.headers)
