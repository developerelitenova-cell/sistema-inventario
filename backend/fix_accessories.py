from database import SessionLocal
import models
import json

db = SessionLocal()
assets = db.query(models.Asset).all()
fixed_count = 0
for a in assets:
    if not a.accessories:
        continue
    new_acc = []
    changed = False
    for acc in a.accessories:
        if isinstance(acc, str):
            # Convert string to AccessoryItem dict
            new_acc.append({"name": acc, "unique_code": ""})
            changed = True
        else:
            new_acc.append(acc)
    if changed:
        a.accessories = new_acc
        db.commit()
        fixed_count += 1

print(f"Fixed {fixed_count} assets with string accessories")
db.close()
