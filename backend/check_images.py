from database import SessionLocal
import models

db = SessionLocal()
assets = db.query(models.Asset).filter(models.Asset.photo_url.isnot(None)).limit(5).all()
for a in assets:
    print(f"Code: {a.unique_code}, Photo: {a.photo_url}")
if not assets:
    print("No assets with photos found.")
