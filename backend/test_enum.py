import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database import SessionLocal
from models import User, RoleEnum

def test_roles():
    db = SessionLocal()
    user = db.query(User).first()
    if user:
        print(f"User role: {user.role}, type: {type(user.role)}")
        roles = (RoleEnum.ADMIN, RoleEnum.ENCARGADO)
        print(f"Role in roles? {user.role in roles}")
test_roles()
