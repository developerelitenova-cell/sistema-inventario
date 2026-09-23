from database import SessionLocal
import models
db = SessionLocal()
users_count = db.query(models.User).count()
assignments_count = db.query(models.Assignment).count()
loans_count = db.query(models.Loan).count()
print(f"Users: {users_count}, Assignments: {assignments_count}, Loans: {loans_count}")
db.close()
