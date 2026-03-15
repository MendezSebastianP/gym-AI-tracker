"""add_duration_seconds_to_sessions

Revision ID: a2f3b4c5d6e7
Revises: 8e84873450a1
Create Date: 2026-03-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2f3b4c5d6e7'
down_revision: Union[str, None] = '8e84873450a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('duration_seconds', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('sessions', 'duration_seconds')
