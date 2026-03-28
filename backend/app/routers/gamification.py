from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.quest import Quest, UserQuest
from app.gamification import _update_quest_progress, claim_quest_reward, assign_quests, exp_for_next_level, compute_streak_weeks, _streak_coins, _current_iso_week_str, _get_week_boundaries, compute_unclaimed_streak_data, get_streak_week_slots

router = APIRouter(
    prefix="/api/gamification",
    tags=["gamification"]
)


@router.get("/stats")
def get_gamification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    streak_reward_week = current_user.streak_reward_week or ""
    unclaimed = compute_unclaimed_streak_data(db, current_user)
    streak_slots = get_streak_week_slots(db, current_user.id, streak_reward_week)
    return {
        "level": current_user.level or 1,
        "experience": current_user.experience or 0,
        "exp_to_next": exp_for_next_level(current_user.level or 1),
        "currency": current_user.currency or 0,
        "joker_tokens": current_user.joker_tokens or 0,
        "streak_reward_week": streak_reward_week,
        "streak_slots": streak_slots,
        "unclaimed_streak_weeks": unclaimed["unclaimed_weeks"],
        "unclaimed_streak_coins": unclaimed["total_coins"],
    }


@router.get("/stats/demo")
def get_gamification_stats_demo(db: Session = Depends(get_db)):
    """Return gamification stats for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.is_demo == True).first()
    if not demo_user:
        return {"level": 1, "experience": 0, "exp_to_next": 100, "currency": 0, "joker_tokens": 0}
    return {
        "level": demo_user.level or 1,
        "experience": demo_user.experience or 0,
        "exp_to_next": exp_for_next_level(demo_user.level or 1),
        "currency": demo_user.currency or 0,
        "joker_tokens": demo_user.joker_tokens or 0,
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


# ── Streak Claim ──────────────────────────────────────────────────────────────

@router.post("/streak/claim")
def claim_streak_reward(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim coins for the oldest unclaimed streak week (one at a time)."""
    data = compute_unclaimed_streak_data(db, current_user)

    if data["unclaimed_weeks"] == 0:
        return {
            "claimed_weeks": 0,
            "streak_coins": 0,
            "remaining": 0,
            "streak_weeks": data["current_streak"],
            "currency": current_user.currency or 0,
            "joker_awarded": False,
        }

    # Claim only the oldest unclaimed week
    oldest_week, week_coins = data["coins_per_week"][0]
    current_user.currency = (current_user.currency or 0) + week_coins
    current_user.streak_reward_week = oldest_week

    # Award joker only when claiming the final remaining week
    joker_awarded = False
    if data["joker_due"] and data["unclaimed_weeks"] == 1:
        current_user.joker_tokens = (current_user.joker_tokens or 0) + 1
        joker_awarded = True

    db.commit()
    db.refresh(current_user)

    return {
        "claimed_weeks": 1,
        "streak_coins": week_coins,
        "remaining": data["unclaimed_weeks"] - 1,
        "streak_weeks": data["current_streak"],
        "currency": current_user.currency,
        "joker_awarded": joker_awarded,
    }


# ── Shop ──────────────────────────────────────────────────────────────────────

SKIN_ITEMS = [
    {
        "id": "skin_a",
        "name": "Ember — Campfire",
        "description": "Warm organic layered flames with rising licks. The default skin.",
        "price": 0,
        "type": "streak_skin",
        "rarity": "common",
        "accent": "#FF8C00",
    },
    {
        "id": "skin_b",
        "name": "Arcane Crystal Flame",
        "description": "Angular faceted crystal with violet gradient. Wind-blown tip motion.",
        "price": 100,
        "type": "streak_skin",
        "rarity": "rare",
        "accent": "#CE93D8",
    },
    {
        "id": "skin_c1",
        "name": "Inferno Orb",
        "description": "Molten fire sphere with rotating inner swirl. Three orbiting sparks when claimable.",
        "price": 150,
        "type": "streak_skin",
        "rarity": "rare",
        "accent": "#FF9500",
    },
    {
        "id": "skin_c2",
        "name": "Aurum Orb",
        "description": "Liquid gold sphere. Slow reverse swirl gives a precious, metallic feel. Included with Gold Edition.",
        "price": 300,
        "type": "streak_skin",
        "rarity": "epic",
        "accent": "#FFD700",
        "included_with": "theme_gold",
    },
    {
        "id": "skin_c3",
        "name": "Tempest Orb",
        "description": "Electric storm sphere. Lightning bolts arc inside. Fast swirl and triple orbit sparks.",
        "price": 200,
        "type": "streak_skin",
        "rarity": "epic",
        "accent": "#42A5F5",
    },
    {
        "id": "skin_d",
        "name": "8-BIT Pixel Fire",
        "description": "Stacked pixel blocks with choppy steps() jumps. Scanline CRT overlay. Retro arcade feel.",
        "price": 300,
        "type": "streak_skin",
        "rarity": "legendary",
        "accent": "#FF9900",
    },
]


def _skin_owned(item_id: str, settings: dict) -> bool:
    """Determine if a skin is owned, considering free and bundle cases."""
    if item_id == "skin_a":
        return True
    if item_id == "skin_c2" and "theme_gold" in settings.get("purchased_themes", []):
        return True
    return item_id in settings.get("purchased_skins", [])


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
        "price": 200,
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
        "price": 1000,
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
    skin_items = [
        {**skin, "owned": _skin_owned(skin["id"], settings)}
        for skin in SKIN_ITEMS
    ]
    return {
        "items": items,
        "skin_items": skin_items,
        "currency": current_user.currency or 0,
        "active_theme": settings.get("active_theme", "dark"),
        "active_streak_skin": settings.get("active_streak_skin", "skin_a"),
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
    skin_items = [
        {**skin, "owned": _skin_owned(skin["id"], settings)}
        for skin in SKIN_ITEMS
    ]
    return {
        "items": items,
        "skin_items": skin_items,
        "currency": (demo_user.currency or 0) if demo_user else 0,
        "active_theme": settings.get("active_theme", "dark"),
        "active_streak_skin": settings.get("active_streak_skin", "skin_a"),
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
    """Purchase a shop item (theme or streak skin) with currency."""
    all_items = SHOP_ITEMS + SKIN_ITEMS
    item = next((i for i in all_items if i["id"] == req.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    settings = dict(current_user.settings or {})

    # Already owned?
    if item["type"] == "theme":
        purchased = list(settings.get("purchased_themes", []))
        if item["id"] == "theme_dark" or item["id"] in purchased:
            raise HTTPException(status_code=400, detail="Already owned")
    else:  # streak_skin
        if _skin_owned(item["id"], settings):
            raise HTTPException(status_code=400, detail="Already owned")

    if (current_user.currency or 0) < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")

    current_user.currency = max(0, (current_user.currency or 0) - item["price"])

    if item["type"] == "theme":
        purchased = list(settings.get("purchased_themes", []))
        purchased.append(item["id"])
        settings["purchased_themes"] = purchased
        # Gold Edition bonus: grant Aurum Orb for free
        if item["id"] == "theme_gold":
            purchased_skins = list(settings.get("purchased_skins", []))
            if "skin_c2" not in purchased_skins:
                purchased_skins.append("skin_c2")
                settings["purchased_skins"] = purchased_skins
    else:  # streak_skin
        purchased_skins = list(settings.get("purchased_skins", []))
        purchased_skins.append(item["id"])
        settings["purchased_skins"] = purchased_skins

    current_user.settings = settings
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "currency": current_user.currency,
        "purchased_themes": settings.get("purchased_themes", []),
        "purchased_skins": settings.get("purchased_skins", []),
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


class SkinActivateRequest(BaseModel):
    skin_id: str = PydanticField(max_length=50)


@router.post("/shop/activate-skin")
def activate_skin(
    req: SkinActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a purchased streak skin."""
    settings = dict(current_user.settings or {})
    if not _skin_owned(req.skin_id, settings):
        raise HTTPException(status_code=400, detail="Skin not owned")

    settings["active_streak_skin"] = req.skin_id
    current_user.settings = settings
    db.commit()
    db.refresh(current_user)
    return {"success": True, "active_streak_skin": req.skin_id}


# ── Promo Codes ───────────────────────────────────────────────────────────────

PROMO_CODES = {
    "PACHO": 2_000,
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


@router.post("/joker-streak")
def use_joker_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Use a joker token to save a dying streak. Must be used during the empty week."""
    from app.gamification import use_joker_for_streak
    return use_joker_for_streak(db, current_user)
