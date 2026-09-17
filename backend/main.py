import os
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import models
from database import engine
from routes import (
    auth_router,
    users_router,
    warehouses_router,
    assets_router,
    loans_router,
    assignments_router,
    requests_router,
    audit_router,
)

load_dotenv()

# Crear tablas en BD
models.Base.metadata.create_all(bind=engine)

APP_PASSWORD = os.environ.get("APP_PASSWORD")


def verify_password(x_app_password: Optional[str] = Header(default=None)):
    # Se exige que APP_PASSWORD esté siempre configurado por seguridad.
    if not APP_PASSWORD:
        raise HTTPException(status_code=500, detail="El servidor no tiene configurada una clave de seguridad global")
    if (x_app_password or "").strip() != APP_PASSWORD.strip():
        raise HTTPException(status_code=401, detail="Clave de acceso inválida")


app = FastAPI(
    title="Control de Inventario y Activos",
    dependencies=[Depends(verify_password)],
)

raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
if raw_origins:
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Basic Rate Limiting Middleware ---
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class BasicRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.ip_records = {}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/auth/login") or path.startswith("/assets/estimate") or path.startswith("/api/assets/estimate"):
            ip = request.client.host
            now = time.time()
            # Limpiar IPs viejas
            self.ip_records = {k: v for k, v in self.ip_records.items() if v["reset_time"] > now}
            
            record = self.ip_records.get(ip)
            if not record:
                self.ip_records[ip] = {"count": 1, "reset_time": now + 60}
            else:
                if record["count"] >= 10:  # 10 peticiones por minuto
                    return JSONResponse(status_code=429, content={"detail": "Demasiadas peticiones. Intente más tarde."})
                self.ip_records[ip]["count"] += 1
                
        return await call_next(request)

app.add_middleware(BasicRateLimitMiddleware)


@app.get("/ping-auth")
def ping_auth():
    """
    Ruta pública (solo protegida por APP_PASSWORD global) para que el frontend 
    verifique si la clave de acceso general es correcta sin requerir un token JWT.
    """
    return {"status": "ok"}


# Registro de Routers Modulares
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(warehouses_router)
app.include_router(assets_router)
app.include_router(loans_router)
app.include_router(assignments_router)
app.include_router(requests_router)
app.include_router(audit_router)
