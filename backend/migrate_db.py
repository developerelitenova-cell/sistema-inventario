import os
import sys
import sqlalchemy
from sqlalchemy import create_engine, text

# Old Database Details
OLD_HOST = "aws-0-us-east-1.pooler.supabase.com"
OLD_PORT = "5432"
OLD_DBNAME = "postgres"
OLD_USER = "postgres.iphfbavrhduilktwueln"
OLD_PASSWORD = "DKFTIUMyG2pMfkPs"

# New Database Details
# Changing to 5432 (Session pooler / Direct connection compatible) to ensure DDL works
NEW_URL = "postgresql://postgres.jikwjfaeimabyxdcnukm:zQ9kvdWvF84X64hG@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

def migrate():
    # 1. First, create the schema on the NEW database using our FastAPI models
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    import models
    
    print("Connecting to NEW database to initialize schema...")
    new_engine = create_engine(NEW_URL, isolation_level="AUTOCOMMIT")
    
    # 2. Create tables
    models.Base.metadata.create_all(bind=new_engine)
    print("Schema initialized.")
    
    # 3. Apply the dynamic accessories fix directly to the new database
    # Since Base.metadata.create_all() creates it as accessories JSON, we don't need migration 002.
    # Wait, the models.py has `accessories = Column(JSON)`, so it creates it!
    # Same for `borrowed_accessories`. So we don't need any migrations on the new DB, SQLAlchemy creates them correctly.
    
    with new_engine.connect() as conn:
        print("Setting up Foreign Data Wrapper...")
        # Enable postgres_fdw
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgres_fdw;"))
        
        # Create server
        conn.execute(text("DROP SERVER IF EXISTS old_db CASCADE;"))
        conn.execute(text(f"""
            CREATE SERVER old_db
            FOREIGN DATA WRAPPER postgres_fdw
            OPTIONS (host '{OLD_HOST}', dbname '{OLD_DBNAME}', port '{OLD_PORT}');
        """))
        
        # Map user
        conn.execute(text(f"""
            CREATE USER MAPPING FOR CURRENT_USER
            SERVER old_db
            OPTIONS (user '{OLD_USER}', password '{OLD_PASSWORD}');
        """))
        
        # Import schema
        conn.execute(text("DROP SCHEMA IF EXISTS old_schema CASCADE;"))
        conn.execute(text("CREATE SCHEMA old_schema;"))
        conn.execute(text("IMPORT FOREIGN SCHEMA public FROM SERVER old_db INTO old_schema;"))
        
        print("Foreign schema imported. Migrating data...")
        
        # List of tables to migrate IN ORDER (to respect foreign keys)
        # 1. Independent tables
        # 2. Dependent tables
        tables = [
            "warehouses",
            "users",
            "user_warehouses",
            "assets",
            "asset_requests",
            "request_comments",
            "loans",
            "asset_assignments",
            "activity_logs",
            "auth_tokens",
            "role_permissions"
        ]
        
        # Disable constraints temporarily
        conn.execute(text("SET session_replication_role = 'replica';"))
        
        for table in tables:
            print(f"Migrating table {table}...")
            # We clear the table first just in case
            conn.execute(text(f"DELETE FROM {table};"))
            # Insert data from old schema
            # We use SELECT * to pull all columns. Since we used create_all, the column order might differ!
            # So we better specify columns.
            
            # Get columns from old table
            res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema='old_schema' AND table_name='{table}'"))
            cols = [r[0] for r in res]
            
            if cols:
                col_str = ", ".join(cols)
                try:
                    conn.execute(text(f"INSERT INTO {table} ({col_str}) SELECT {col_str} FROM old_schema.{table};"))
                    print(f"  -> Successfully migrated {table}")
                except Exception as e:
                    print(f"  -> Failed to migrate {table}: {e}")
            else:
                print(f"  -> Table {table} not found in old schema.")
        
        # Re-enable constraints
        conn.execute(text("SET session_replication_role = 'origin';"))
        
        # Cleanup
        print("Cleaning up Foreign Data Wrapper...")
        conn.execute(text("DROP SCHEMA old_schema CASCADE;"))
        conn.execute(text("DROP SERVER old_db CASCADE;"))
        
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
