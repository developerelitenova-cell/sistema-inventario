import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

buckets = supabase.storage.list_buckets()
for b in buckets:
    print(b.name, b.public)
