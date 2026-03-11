from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.quest import Quest, UserQuest
from app.gamification import _update_quest_progress, claim_quest_reward, assign_quests, exp_for_next_level

router = APIRouter(
    prefix="/api/gamification",
    tags=["gamification"]
)


@router.get("/stats")
def get_gamification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return current level, experience, and currency for the authenticated user."""
    return {
        "level": current_user.level or 1,
        "experience": current_user.experience or 0,
        "exp_to_next": exp_for_next_level(current_user.level or 1),
        "currency": current_user.currency or 0,
    }


@router.get("/stats/demo")
def get_gamification_stats_demo(db: Session = Depends(get_db)):
    """Return gamification stats for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.is_demo == True).first()
    if not demo_user:
        return {"level": 1, "experience": 0, "exp_to_next": 100, "currency": 0}
    return {
        "level": demo_user.level or 1,
        "experience": demo_user.experience or 0,
        "exp_to_next": exp_for_next_level(demo_user.level or 1),
        "currency": demo_user.currency or 0,
    }


@router.get("/quests/demo")
def get_quests_demo(db: Session = Depends(get_db)):
    """Return quest progress for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.is_demo == True).first()
    if not demo_user:
        return []

    assign_quests(db, demo_user.id)

    user_quests = db.query(UserQuest).filter(
        UserQuest.user_id == demo_user.id
    ).all()

    result = []
    for uq in user_quests:
        quest = db.query(Quest).get(uq.quest_id)
        if not quest:
            continue
        result.append({
            "id": uq.id,
            "quest_id": quest.id,
            "name": quest.name,
            "description": quest.description,
            "icon": quest.icon or "target",
            "req_type": quest.req_type,
            "req_value": quest.req_value,
            "exp_reward": quest.exp_reward,
            "currency_reward": quest.currency_reward,
            "progress": uq.progress,
            "completed": uq.completed,
            "claimed": uq.claimed,
            "completed_at": uq.completed_at.isoformat() if uq.completed_at else None,
        })
    return result


@router.get("/quests")
def get_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all quests assigned to the user with their progress."""
    # Auto-assign any new quests the user doesn't have yet
    assign_quests(db, current_user.id)

    user_quests = db.query(UserQuest).filter(
        UserQuest.user_id == current_user.id
    ).all()

    result = []
    for uq in user_quests:
        quest = db.query(Quest).get(uq.quest_id)
        if not quest:
            continue
        result.append({
            "id": uq.id,
            "quest_id": quest.id,
            "name": quest.name,
            "description": quest.description,
            "icon": quest.icon or "target",
            "req_type": quest.req_type,
            "req_value": quest.req_value,
            "exp_reward": quest.exp_reward,
            "currency_reward": quest.currency_reward,
            "progress": uq.progress,
            "completed": uq.completed,
            "claimed": uq.claimed,
            "completed_at": uq.completed_at.isoformat() if uq.completed_at else None,
            "is_weekly": quest.is_weekly,
        })

    return result


@router.post("/quests/{user_quest_id}/claim")
def claim_quest(
    user_quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim the reward for a completed quest."""
    result = claim_quest_reward(db, current_user, user_quest_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Shop ──────────────────────────────────────────────────────────────────────

SHOP_ITEMS = [
    {
        "id": "theme_dark",
        "name": "Dark Mode",
        "description": "The default sleek dark theme",
        "price": 0,
        "type": "theme",
        "preview": {
            "bg_primary": "#0A0A0F",
            "bg_secondary": "#12121A",
            "text_primary": "#E8E8ED",
            "primary": "#6366f1",
            "accent": "#3B82F6",
        }
    },
    {
        "id": "theme_light",
        "name": "Light Mode",
        "description": "A clean, bright interface theme",
        "price": 50,
        "type": "theme",
        "preview": {
            "bg_primary": "#F5F5F7",
            "bg_secondary": "#FFFFFF",
            "text_primary": "#1A1A1A",
            "primary": "#6366f1",
            "accent": "#3B82F6",
        }
    },
    {
        "id": "theme_gold",
        "name": "Gold Edition",
        "description": "Premium dark gold aesthetic",
        "price": 150,
        "type": "theme",
        "preview": {
            "bg_primary": "#1A1510",
            "bg_secondary": "#2A2318",
            "text_primary": "#F5E6C8",
            "primary": "#FFD700",
            "accent": "#DAA520",
        }
    },
]


@router.get("/shop")
def get_shop(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return available shop items with ownership status."""
    settings = current_user.settings or {}
    purchased = settings.get("purchased_themes", [])

    items = []
    for item in SHOP_ITEMS:
        items.append({
            **item,
            "owned": item["id"] == "theme_dark" or item["id"] in purchased,
        })
    return {
        "items": items,
        "currency": current_user.currency or 0,
        "active_theme": settings.get("active_theme", "dark"),
    }


@router.get("/shop/demo")
def get_shop_demo(db: Session = Depends(get_db)):
    """Return shop items for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.is_demo == True).first()
    settings = (demo_user.settings or {}) if demo_user else {}
    purchased = settings.get("purchased_themes", [])

    items = []
    for item in SHOP_ITEMS:
        items.append({
            **item,
            "owned": item["id"] == "theme_dark" or item["id"] in purchased,
        })
    return {
        "items": items,
        "currency": (demo_user.currency or 0) if demo_user else 0,
        "active_theme": settings.get("active_theme", "dark"),
    }


from pydantic import BaseModel, Field as PydanticField

class ShopBuyRequest(BaseModel):
    item_id: str = PydanticField(max_length=50)


@router.post("/shop/buy")
def buy_shop_item(
    req: ShopBuyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Purchase a shop item with currency."""
    item = next((i for i in SHOP_ITEMS if i["id"] == req.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    settings = dict(current_user.settings or {})
    purchased = list(settings.get("purchased_themes", []))

    if req.item_id in purchased:
        raise HTTPException(status_code=400, detail="Already owned")

    if (current_user.currency or 0) < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")

    current_user.currency -= item["price"]
    purchased.append(req.item_id)
    settings["purchased_themes"] = purchased
    current_user.settings = settings

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "currency": current_user.currency,
        "purchased_themes": purchased,
    }


class ThemeActivateRequest(BaseModel):
    theme: str = PydanticField(max_length=50)


@router.post("/shop/activate")
def activate_theme(
    req: ThemeActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a purchased theme (or 'dark' which is always available)."""
    settings = dict(current_user.settings or {})
    purchased = settings.get("purchased_themes", [])

    if req.theme != "dark" and f"theme_{req.theme}" not in purchased and req.theme not in purchased:
        raise HTTPException(status_code=400, detail="Theme not owned")

    settings["active_theme"] = req.theme
    current_user.settings = settings

    db.commit()
    db.refresh(current_user)

    return {"success": True, "active_theme": req.theme}


# ── Promo Codes ───────────────────────────────────────────────────────────────

PROMO_CODES = {
    "PACHO": 1_000_000,
}


class PromoCodeRequest(BaseModel):
    code: str = PydanticField(max_length=50)


@router.post("/shop/promo")
def redeem_promo_code(
    req: PromoCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Redeem a promo code for coins."""
    code_upper = req.code.strip().upper()
    reward = PROMO_CODES.get(code_upper)

    if not reward:
        raise HTTPException(status_code=400, detail="Invalid promo code")

    settings = dict(current_user.settings or {})
    redeemed = list(settings.get("redeemed_codes", []))

    if code_upper in redeemed:
        raise HTTPException(status_code=400, detail="Code already redeemed")

    current_user.currency = (current_user.currency or 0) + reward
    redeemed.append(code_upper)
    settings["redeemed_codes"] = redeemed
    current_user.settings = settings

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "coins_awarded": reward,
        "currency": current_user.currency,
    }
