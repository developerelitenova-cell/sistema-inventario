import os
import sys

# Agregar el directorio actual al path para poder importar módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User

def cleanup_users():
    db = SessionLocal()
    try:
        # Buscar usuarios que no tienen photo_url (o es nulo)
        users_without_photo = db.query(User).filter(
            (User.photo_url == None) | (User.photo_url == '')
        ).all()
        
        count = len(users_without_photo)
        print(f"Se encontraron {count} usuarios sin foto de perfil.")
        
        if count == 0:
            print("No hay usuarios para eliminar.")
            return

        for user in users_without_photo:
            print(f"Eliminando usuario: {user.email} - {user.full_name}")
            db.delete(user)
            
        db.commit()
        print(f"Se eliminaron {count} usuarios exitosamente.")
        
    except Exception as e:
        print(f"Ocurrió un error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_users()
