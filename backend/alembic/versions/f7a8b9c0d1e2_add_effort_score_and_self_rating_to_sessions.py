"""add_effort_score_and_self_rating_to_sessions

Revision ID: f7a8b9c0d1e2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-28 21:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('effort_score', sa.Float(), nullable=True))
    op.add_column('sessions', sa.Column('self_rated_effort', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('sessions', 'self_rated_effort')
    op.drop_column('sessions', 'effort_score')
