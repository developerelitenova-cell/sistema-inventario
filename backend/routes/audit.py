from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from services import auth as auth_service

router = APIRouter(prefix="/activity-logs", tags=["Auditoría"])


@router.get("/", response_model=List[schemas.ActivityLog])
def get_activity_logs(
    entity_type: Optional[str] = None,
    actor_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_service.get_current_user),
):
    query = db.query(models.ActivityLog)
    
    if not auth_service.is_master_admin(current_user):
        actor_id = current_user.id

    if entity_type:
        query = query.filter(models.ActivityLog.entity_type == entity_type)
    if actor_id:
        query = query.filter(models.ActivityLog.actor_id == actor_id)

    return (
        query.order_by(models.ActivityLog.created_at.desc())
        .offset(offset)
        .limit(min(limit, 200))
        .all()
    )
