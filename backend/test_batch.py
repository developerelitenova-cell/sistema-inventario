from database import SessionLocal
import models
from services.auth import create_token
from routes.assets import batch_generate_assets
import schemas

db = SessionLocal()
admin = db.query(models.User).filter(models.User.role == models.RoleEnum.ADMIN).first()
if admin:
    print(f"Admin found: {admin.username}")
    payload = schemas.AssetBatchGenerate(
        module="prueba",
        prefix="AA",
        quantity=1
    )
    try:
        created = batch_generate_assets(payload=payload, db=db, _user=admin)
        print("Success:", [a.unique_code for a in created])
    except Exception as e:
        print("Error:", repr(e))
else:
    print("No admin found")
