import requests
from database import SessionLocal
import models
from services.auth import create_token
import urllib.parse

db = SessionLocal()
user = db.query(models.User).filter(models.User.role == 'ADMIN').first()
token = create_token(db, user)
db.close()

headers = {"Authorization": f"Bearer {token}", "Origin": "https://sistema-inventario-lyart-eta.vercel.app"}
module = urllib.parse.quote("Elite Nutrition")
res = requests.get(f"https://sistema-inventario-kxdc.onrender.com/assets/?module={module}", headers=headers)
print(f"Status: {res.status_code}")
if res.status_code != 200:
    print(res.text[:500])
