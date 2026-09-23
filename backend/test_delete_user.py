import os
import sys
import traceback
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import SessionLocal
from models import User, RoleEnum
from fastapi import HTTPException
from routes.users import delete_user

def run_test():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == RoleEnum.ADMIN).first()
    
    user = db.query(User).filter(User.username == "dummy.delete.test").first()
    if not user:
        print("User not found")
        return
        
    try:
        delete_user(user.id, db, admin)
        print("Delete successful!")
    except Exception as e:
        print("Delete failed!")
        traceback.print_exc()

run_test()
