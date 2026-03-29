"""add_set_type_and_to_failure_to_sets

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-03-28 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sets', sa.Column('set_type', sa.String(), server_default='normal', nullable=False))
    op.add_column('sets', sa.Column('to_failure', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('sets', 'to_failure')
    op.drop_column('sets', 'set_type')
