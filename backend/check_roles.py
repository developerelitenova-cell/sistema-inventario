import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database import SessionLocal
from models import User

def check_roles():
    db = SessionLocal()
    users = db.query(User).all()
    for u in users:
        print(f"User: {u.username}, Role: {u.role}")

check_roles()
