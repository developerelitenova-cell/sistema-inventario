import sys
from database import SessionLocal
import models
from services.auth import create_token

def get_token():
    db = SessionLocal()
    user = db.query(models.User).first()
    if not user:
        print("No users found")
        return
    token_str, auth_token = create_token(db, user) # wait, create_token returns (str, models.AuthToken)? Let me check!
    # I need to see exactly what create_token returns
