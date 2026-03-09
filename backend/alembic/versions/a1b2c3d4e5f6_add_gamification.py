"""add gamification tables and columns

Revision ID: a1b2c3d4e5f6
Revises: c5592eab8cac
Create Date: 2026-03-08 21:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c5592eab8cac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Gamification columns on users
    op.add_column('users', sa.Column('level', sa.Integer(), server_default='1', nullable=False))
    op.add_column('users', sa.Column('experience', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('currency', sa.Integer(), server_default='0', nullable=False))

    # Quests table
    op.create_table(
        'quests',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('req_type', sa.String(50), nullable=False),
        sa.Column('req_value', sa.Integer(), nullable=False),
        sa.Column('exp_reward', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('currency_reward', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('icon', sa.String(50), nullable=True, server_default='target'),
        sa.Column('is_repeatable', sa.Boolean(), server_default='false'),
    )

    # User quests (progress tracking)
    op.create_table(
        'user_quests',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('quest_id', sa.Integer(), sa.ForeignKey('quests.id'), nullable=False),
        sa.Column('progress', sa.Integer(), server_default='0'),
        sa.Column('completed', sa.Boolean(), server_default='false'),
        sa.Column('claimed', sa.Boolean(), server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed default quests
    quests_table = sa.table(
        'quests',
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('req_type', sa.String),
        sa.column('req_value', sa.Integer),
        sa.column('exp_reward', sa.Integer),
        sa.column('currency_reward', sa.Integer),
        sa.column('icon', sa.String),
    )
    op.bulk_insert(quests_table, [
        {"name": "First Steps", "description": "Complete your first workout session", "req_type": "sessions", "req_value": 1, "exp_reward": 25, "currency_reward": 5, "icon": "footprints"},
        {"name": "Getting Started", "description": "Complete 5 workout sessions", "req_type": "sessions", "req_value": 5, "exp_reward": 75, "currency_reward": 15, "icon": "rocket"},
        {"name": "Dedicated Lifter", "description": "Complete 25 workout sessions", "req_type": "sessions", "req_value": 25, "exp_reward": 200, "currency_reward": 50, "icon": "trophy"},
        {"name": "Iron Regular", "description": "Complete 50 workout sessions", "req_type": "sessions", "req_value": 50, "exp_reward": 500, "currency_reward": 100, "icon": "medal"},
        {"name": "Gym Veteran", "description": "Complete 100 workout sessions", "req_type": "sessions", "req_value": 100, "exp_reward": 1000, "currency_reward": 200, "icon": "crown"},
        {"name": "Set Machine", "description": "Complete 100 total sets", "req_type": "sets", "req_value": 100, "exp_reward": 50, "currency_reward": 10, "icon": "repeat"},
        {"name": "Set Destroyer", "description": "Complete 500 total sets", "req_type": "sets", "req_value": 500, "exp_reward": 150, "currency_reward": 40, "icon": "zap"},
        {"name": "Volume King", "description": "Lift 10,000 kg in total volume", "req_type": "volume", "req_value": 10000, "exp_reward": 100, "currency_reward": 25, "icon": "weight"},
        {"name": "Tonnage Master", "description": "Lift 100,000 kg in total volume", "req_type": "volume", "req_value": 100000, "exp_reward": 300, "currency_reward": 75, "icon": "mountain"},
        {"name": "Million Club", "description": "Lift 1,000,000 kg in total volume", "req_type": "volume", "req_value": 1000000, "exp_reward": 1000, "currency_reward": 250, "icon": "sparkles"},
    ])


def downgrade() -> None:
    op.drop_table('user_quests')
    op.drop_table('quests')
    op.drop_column('users', 'currency')
    op.drop_column('users', 'experience')
    op.drop_column('users', 'level')
