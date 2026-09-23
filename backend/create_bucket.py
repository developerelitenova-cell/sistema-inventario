import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

try:
    res = supabase.storage.create_bucket("inventory-assets", options={"public": True})
    print(f"Bucket inventory-assets created:", res)
except Exception as e:
    print(f"Bucket error:", e)
