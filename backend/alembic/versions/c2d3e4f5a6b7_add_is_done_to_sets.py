"""add is_done to sets

Revision ID: c2d3e4f5a6b7
Revises: c1d2e3f4a5b7
Create Date: 2026-05-13 12:05:00.000000

Persists the per-set "done" checkmark from the active session UI on the
backend. Required because iPhone Safari/Edge can evict IndexedDB silently,
so local-only state vanishes mid-session.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'c1d2e3f4a5b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sets',
        sa.Column('is_done', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )


def downgrade() -> None:
    op.drop_column('sets', 'is_done')
