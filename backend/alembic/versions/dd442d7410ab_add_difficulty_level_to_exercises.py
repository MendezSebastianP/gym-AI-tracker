"""add_difficulty_level_to_exercises

Revision ID: dd442d7410ab
Revises: c7465586225e
Create Date: 2026-03-18 17:43:41.853876

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd442d7410ab'
down_revision: Union[str, None] = 'c7465586225e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exercises', sa.Column('difficulty_level', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('exercises', 'difficulty_level')
