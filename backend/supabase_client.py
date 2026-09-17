import os
import base64
from supabase import create_client, Client
from datetime import datetime

# Se asume que las variables de entorno están configuradas (p.ej. por Vercel o localmente en .env)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def upload_base64_image(base64_string: str, bucket_name: str, folder: str, filename_prefix: str, is_private: bool = False) -> str | None:
    """
    Decodifica una imagen en base64 y la sube a Supabase Storage con sanitización defensiva.
    Retorna la URL pública de la imagen o None en caso de fallo.
    """
    if not supabase:
        print("Warning: Supabase credentials not found. Cannot upload image.")
        return None

    if not base64_string:
        return None

    # Extraer el contenido base64 si incluye el prefijo data:image/...;base64,
    if "base64," in base64_string:
        header, base64_data = base64_string.split("base64,")
        try:
            mime_sub = header.split(";")[0].split("/")[1].lower()
            ext = "jpeg" if mime_sub == "jpg" else mime_sub
        except Exception:
            ext = "png"
    else:
        base64_data = base64_string
        ext = "png"

    # Sanitización: Rechazar extensiones no permitidas (ej. svg, html, php, etc.)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        print(f"Security Warning: Extension '{ext}' not allowed in upload.")
        return None

    try:
        image_bytes = base64.b64decode(base64_data)
        
        # Limitar tamaño máximo para prevenir agotamiento de memoria / DoS
        if len(image_bytes) > MAX_IMAGE_BYTES:
            print(f"Security Warning: Image size {len(image_bytes)} exceeds {MAX_IMAGE_BYTES} bytes limit.")
            return None

        # Sanitizar prefijo para evitar directory traversal
        clean_prefix = "".join(c for c in filename_prefix if c.isalnum() or c in ("-", "_")).strip() or "image"
        clean_folder = folder.strip("/").replace("..", "")

        # Generar un nombre de archivo único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{clean_folder}/{clean_prefix}_{timestamp}.{ext}"
        
        # Subir al bucket
        response = supabase.storage.from_(bucket_name).upload(
            file=image_bytes,
            path=filename,
            file_options={"content-type": f"image/{ext}"}
        )
        
        # Obtener URL
        if is_private:
            signed = supabase.storage.from_(bucket_name).create_signed_url(filename, 3600 * 24 * 7) # 7 días
            return signed.get('signedURL', signed) if type(signed) is dict else signed
        else:
            return supabase.storage.from_(bucket_name).get_public_url(filename)
    except Exception as e:
        print(f"Error uploading image to Supabase: {e}")
        return None
