"""backfill bw_ratio for chain exercises

Revision ID: c1d2e3f4a5b7
Revises: b7c8d9e0f1a2
Create Date: 2026-05-13 12:00:00.000000

Backfills explicit bw_ratio values for every bodyweight exercise that appears
in a progression chain but was previously falling back to the 0.65 default
in apply_scoring(). Without this, harder chain variants (e.g. Wide Push Up)
could score the SAME or LOWER NSS than easier ones at fewer reps.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c1d2e3f4a5b7'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Name → new bw_ratio. Kept in sync with the additions in
# backend/app/exercise_scoring.py BW_RATIOS (search "PROGRESSION CHAIN AUDIT").
BW_RATIO_BACKFILL = {
    'Wall Push Up':             0.25,
    'Incline Push Up':          0.40,
    'Knee Push Up':             0.50,
    'Wide Push Up':             0.70,
    'One Arm Push Up':          1.60,
    'Decline Push Up':          0.70,
    'Decline Pike Push Up':     0.72,
    'Bench Dips':               0.50,
    'Negative Dip':             0.75,
    'Scapular Pull Up':         0.30,
    'Negative Pull Up':         0.50,
    'Band Assisted Pull Up':    0.70,
    'Ring Row':                 0.40,
    'Jumping Squat':            0.50,
    'Assisted Pistol Squat':    1.10,
    'Bicycle Crunches':         0.35,
    'Windshield Wipers':        0.85,
    'Tuck L-Sit':               0.58,
    'V-Ups':                    0.65,
    'Hollow Body Rocks':        0.45,
}


def upgrade() -> None:
    for name, ratio in BW_RATIO_BACKFILL.items():
        op.execute(
            f"UPDATE exercises SET bw_ratio = {ratio} "
            f"WHERE name = '{name.replace(chr(39), chr(39) + chr(39))}' "
            f"AND is_bodyweight = true"
        )


def downgrade() -> None:
    # Reset to the default fallback (0.65). NSS is computed on-the-fly,
    # so reverting just sets the rows back to the pre-migration state.
    for name in BW_RATIO_BACKFILL:
        op.execute(
            f"UPDATE exercises SET bw_ratio = 0.65 "
            f"WHERE name = '{name.replace(chr(39), chr(39) + chr(39))}' "
            f"AND is_bodyweight = true"
        )
