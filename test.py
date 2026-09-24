from datetime import datetime
from pydantic import BaseModel
class A(BaseModel):
  d: datetime
print(A(d=datetime.now()).model_dump_json())
