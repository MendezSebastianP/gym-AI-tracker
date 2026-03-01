from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.sync import SyncEvent
from app.schemas import SyncEventCreate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/sync",
    tags=["sync"]
)

@router.post("")
def sync_events(
    events: list[SyncEventCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # MVP: Log events, effectively "client wins" implicit by processing order
    # In a real implementation we would process each event to update DB entities
    # and map client temp IDs to server IDs.
    
    # For now, we'll just acknowledge receipt.
    # The client-side logic will be heavy lifting here in v1.
    return {"status": "synced", "processed": len(events)}
