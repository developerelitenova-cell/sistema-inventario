import os
from dotenv import load_dotenv
load_dotenv()
import supabase_client
# small 1x1 transparent png
base64_img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
url = supabase_client.upload_base64_image(base64_img, "inventory-assets", "test", "test_upload")
print("Uploaded URL:", url)
