import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import SessionLocal
from models import Asset

def run_test():
    db = SessionLocal()
    try:
        a = db.query(Asset).first()
        print(f"Asset found: {a.unique_code}")
    except Exception as e:
        print(f"Error: {e}")

run_test()
