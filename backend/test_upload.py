import requests
import os

url = "https://sistema-inventario-kxdc.onrender.com/ping-auth"
print(requests.get(url).text)
