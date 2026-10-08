import sys
from database import SessionLocal
import models

db = SessionLocal()
users = db.query(models.User).filter(models.User.email.ilike("%diseno%")).all()
for u in users:
    print(f"ID: {u.id}, Name: {u.full_name}, Email: '{u.email}', Doc: {u.document_id}, Active: {u.is_active}, Has Password: {bool(u.password_hash)}")
    
if not users:
    print("No user found with email 'diseno'.")
    
users2 = db.query(models.User).order_by(models.User.id.desc()).limit(5).all()
print("\nLast 5 registered users:")
for u in users2:
    print(f"ID: {u.id}, Name: {u.full_name}, Email: '{u.email}', Doc: {u.document_id}, Active: {u.is_active}")
