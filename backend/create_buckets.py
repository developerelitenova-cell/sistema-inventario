import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

for bucket in ["users", "assets"]:
    try:
        res = supabase.storage.create_bucket(bucket, options={"public": True})
        print(f"Bucket {bucket} created:", res)
    except Exception as e:
        print(f"Bucket {bucket} error:", e)

buckets = supabase.storage.list_buckets()
for b in buckets:
    print(b.name, getattr(b, "public", True))
