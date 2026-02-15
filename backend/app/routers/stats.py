from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.session import Session as SessionModel, Set as SetModel
from app.dependencies import get_current_user
from app.models.user import User
from sqlalchemy import func, desc
from typing import List, Dict, Any
from datetime import datetime, timedelta, date

router = APIRouter(
    prefix="/stats",
    tags=["stats"]
)

@router.get("/weekly")
def get_weekly_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Total Sessions
    total_sessions = db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None)
    ).count()

    # 2. Total Volume (Lifetime)
    # Join sessions and sets to ensure we only count sets from completed sessions of this user
    # Volume = sum(weight_kg * reps) where weight_kg > 0
    total_volume_query = db.query(func.sum(SetModel.weight_kg * SetModel.reps)).join(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None),
        SetModel.weight_kg > 0,
        SetModel.reps > 0
    )
    total_volume = total_volume_query.scalar() or 0

    # 3. Fetch session dates for charting and streaks
    # Get all completed session dates, ordered by date desc
    sessions_dates = db.query(SessionModel.completed_at).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None)
    ).order_by(desc(SessionModel.completed_at)).all()
    
    # Convert to list of datetime objects
    dates = [s[0] for s in sessions_dates if s[0]]

    # 4. Weekly Stats (Last 8 weeks)
    # 0 = Current week, 1 = Last week, etc.
    weekly_counts = [0] * 8
    today = datetime.now().date()
    # Find start of current week (Monday)
    start_of_week = today - timedelta(days=today.weekday())
    
    for d in dates:
        d_date = d.date()
        # Calculate diff in weeks
        delta_days = (start_of_week - d_date).days
        # If negative, it means it's in the future (timezone issues?) or later today, treat as current week
        if delta_days < 0:
            week_idx = 0
        else:
            week_idx = (delta_days // 7) 
            if d_date > start_of_week: # Should not happen if logic is correct, but just in case
                 week_idx = 0
            
            # Correction: 
            # If today is Wednesday, start_of_week is Monday.
            # If d_date is Sunday (yesterday), delta is 1 (Monday - Sunday = 1). 1 // 7 = 0.
            # But Sunday belongs to previous week? ISO week starts Monday.
            # Yes, standard python weekday: Mon=0, Sun=6.
            # If I use Monday as start, then anything from Mon->Sun falls in same bucket.
            # My simple logic: (Start_of_Current_Week - Date) / 7.
            # If Date is in current week [Mon...Sun], delta is <= 0 (if future) or >= 0.
            # Wait. 
            # Case 1: Today Mon. Start=Mon. Date=Mon. Delta=0. Week=0. Correct.
            # Case 2: Today Mon. Start=Mon. Date=Sun (yesterday). Delta=1. Week=0? No, should be 1.
            # 1 // 7 is 0. 
            # So simple division is not enough. I need strictly previous weeks.
            # Correct logic:
            # Week start (Mon) of current week is `start_of_week`.
            # If date < start_of_week, it is previous week.
            # difference in days / 7, but we need to handle the offset.
            # Let's use isocalendar.
            pass

    # Re-impl using ISO calendar
    current_year, current_week, _ = today.isocalendar()
    
    weekly_map = {} # (year, week) -> count
    
    for d in dates:
        y, w, _ = d.date().isocalendar()
        if (y, w) not in weekly_map:
            weekly_map[(y, w)] = 0
        weekly_map[(y, w)] += 1
        
    # Fill array [Week-7, ..., Week-0]
    # We want strictly last 8 weeks ending with current week.
    weekly_counts = []
    # Iterate backwards 7 times
    # Note: isocalendar week logic is tricky around new year (e.g. week 53 -> 1).
    # Using datetime subtraction is safer.
    
    for i in range(8):
        # Target week start
        target_start = start_of_week - timedelta(weeks=i)
        # Target week end (Sunday)
        target_end = target_start + timedelta(days=6)
        
        count = 0
        for d in dates:
            d_date = d.date()
            if target_start <= d_date <= target_end:
                count += 1
        weekly_counts.append(count)
    
    weekly_counts.reverse() # [Week-7, ..., Current]

    # 5. Daily Stats (Last 7 days)
    daily_counts = [0] * 7
    for i in range(7):
        target_day = today - timedelta(days=i)
        count = 0
        for d in dates:
             if d.date() == target_day:
                 count += 1
        daily_counts[6-i] = count # 0 is today (last index), 6 is 7 days ago (index 0)

    # 6. Active Streak (Weeks)
    # Consecutive weeks with at least 1 session, starting from current or previous week.
    streak_weeks = 0
    # Provide a generous lookback for streak (52 weeks)
    # Check if current week has session
    has_current = False
    target_start = start_of_week
    target_end = target_start + timedelta(days=6)
    for d in dates:
        if target_start <= d.date() <= target_end:
            has_current = True
            break
            
    if has_current:
        streak_weeks += 1
        # Check previous weeks
        i = 1
        while True:
            target_start = start_of_week - timedelta(weeks=i)
            target_end = target_start + timedelta(days=6)
            found = False
            for d in dates:
                if target_start <= d.date() <= target_end:
                    found = True
                    break
            if found:
                streak_weeks += 1
                i += 1
            else:
                break
    else:
        # If current week has no session, check if last week had one (streak active but not extended yet)
        # If last week had session, streak = 1 + ...
        # If last week had no session, streak = 0.
        target_start = start_of_week - timedelta(weeks=1)
        target_end = target_start + timedelta(days=6)
        has_last = False
        for d in dates:
            if target_start <= d.date() <= target_end:
                has_last = True
                break
        
        if has_last:
            streak_weeks += 1
            i = 2
            while True:
                target_start = start_of_week - timedelta(weeks=i)
                target_end = target_start + timedelta(days=6)
                found = False
                for d in dates:
                    if target_start <= d.date() <= target_end:
                        found = True
                        break
                if found:
                    streak_weeks += 1
                    i += 1
                else:
                    break

    return {
        "sessions": total_sessions,
        "volume": int(total_volume),
        "weekly_sessions": weekly_counts,
        "daily_sessions": daily_counts,
        "streak_weeks": streak_weeks
    }
