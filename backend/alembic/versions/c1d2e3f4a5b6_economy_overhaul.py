"""economy_overhaul

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-03-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New table: routine_completions
    op.create_table(
        'routine_completions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('routine_id', sa.Integer(), sa.ForeignKey('routines.id'), nullable=False, index=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # New columns on users for streak rewards and joker tokens
    op.add_column('users', sa.Column('streak_reward_week', sa.String(), nullable=True))
    op.add_column('users', sa.Column('joker_tokens', sa.Integer(), server_default='0', nullable=False))

    # Seed weekly quests (8 quests, 2 per week group A/B/C/D)
    op.execute("""
        INSERT INTO quests (name, description, req_type, req_value, exp_reward, currency_reward, is_weekly, week_group)
        VALUES
            ('Weekly Warrior', 'Complete 3 sessions this week', 'sessions', 3, 30, 10, true, 'A'),
            ('Set Sprint', 'Complete 40 sets this week', 'sets', 40, 20, 5, true, 'A'),
            ('Dedication', 'Complete 4 sessions this week', 'sessions', 4, 40, 15, true, 'B'),
            ('Volume Push', 'Lift 5,000 kg total volume this week', 'volume', 5000, 25, 10, true, 'B'),
            ('Consistency', 'Complete 3 sessions this week', 'sessions', 3, 30, 10, true, 'C'),
            ('Endurance', 'Log 30 minutes of training this week', 'duration', 30, 20, 10, true, 'C'),
            ('Iron Week', 'Complete 5 sessions this week', 'sessions', 5, 50, 20, true, 'D'),
            ('Set Grinder', 'Complete 60 sets this week', 'sets', 60, 30, 10, true, 'D')
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    # Remove weekly quests
    op.execute("""
        DELETE FROM quests WHERE is_weekly = true AND name IN (
            'Weekly Warrior', 'Set Sprint', 'Dedication', 'Volume Push',
            'Consistency', 'Endurance', 'Iron Week', 'Set Grinder'
        );
    """)

    op.drop_column('users', 'joker_tokens')
    op.drop_column('users', 'streak_reward_week')
    op.drop_table('routine_completions')
