from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("SELECT setval('auth_tokens_id_seq', COALESCE((SELECT MAX(id)+1 FROM auth_tokens), 1), false);"))
    conn.commit()
    print("Sequence fixed")
