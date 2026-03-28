"""add streak_eligible_at to sessions

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-03-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('streak_eligible_at', sa.DateTime(timezone=True), nullable=True))
    # Backfill: existing completed sessions get their completed_at as the eligible time
    op.execute("UPDATE sessions SET streak_eligible_at = completed_at WHERE completed_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column('sessions', 'streak_eligible_at')
