import os
import requests
from database import SessionLocal
import models
from services.auth import create_token

def run_tests():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.role == 'ADMIN').first()
    if not user:
        user = db.query(models.User).first()
        if not user:
            print("No users in db")
            return
            
    token = create_token(db, user)
    db.close()
    
    headers = {"Authorization": f"Bearer {token}", "Origin": "https://sistema-inventario-lyart-eta.vercel.app"}
    base_url = "https://sistema-inventario-kxdc.onrender.com"
    
    endpoints = [
        "/assignments/?status_filter=active",
        "/assets/",
        "/users/",
        "/asset-requests/?status_filter=pending"
    ]
    
    for ep in endpoints:
        print(f"Testing {ep} ...")
        try:
            res = requests.get(f"{base_url}{ep}", headers=headers)
            print(f"Status: {res.status_code}")
            if res.status_code != 200:
                print(res.text[:500])
        except Exception as e:
            print(f"Failed to connect: {e}")

if __name__ == "__main__":
    run_tests()
