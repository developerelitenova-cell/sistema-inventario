from database import SessionLocal
import models
import schemas
from pydantic import ValidationError

db = SessionLocal()
assets = db.query(models.Asset).all()
for a in assets:
    try:
        schemas.Asset.model_validate(a)
    except ValidationError as e:
        print(f"Asset ID {a.id} failed validation!")
        print(e)
db.close()
