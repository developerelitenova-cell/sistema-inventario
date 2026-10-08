import requests
import json
import base64
import os

url = "https://sistema-inventario-kxdc.onrender.com/auth/login"
resp = requests.post(url, json={"username": "admin", "password": "123"})
if resp.status_code == 200:
    token = resp.json().get("access_token")
    print("Logged in")
    
    photo_data = os.urandom(6 * 1024 * 1024) # 6MB random data (simulate large photo)
    headers = {"Authorization": f"Bearer {token}"}
    
    files = {'photo': ('test.jpg', photo_data, 'image/jpeg')}
    res = requests.post("https://sistema-inventario-kxdc.onrender.com/assets/1/photo", headers=headers, files=files)
    print(res.status_code)
    print(res.text)
else:
    print("Login failed", resp.text)
