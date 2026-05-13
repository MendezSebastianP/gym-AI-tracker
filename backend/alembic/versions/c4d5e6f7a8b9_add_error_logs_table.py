"""add error_logs table

Revision ID: c4d5e6f7a8b9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-13 12:15:00.000000

Persistent storage for self-hosted error tracking. Frontend uncaught
errors and backend exception middleware both write rows here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False, server_default='error'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('stack', sa.Text(), nullable=True),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('context', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('error_logs')
