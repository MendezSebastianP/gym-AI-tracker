"""add_progression_tables

Revision ID: f1a2b3c4d5e6
Revises: 1e796a09e5aa
Create Date: 2026-03-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '1e796a09e5aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── progression_reports ──────────────────────────────────────────
    op.create_table(
        'progression_reports',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('routine_id', sa.Integer(), sa.ForeignKey('routines.id'), nullable=False, index=True),
        sa.Column('day_index', sa.Integer(), nullable=True),
        sa.Column('report_data', sa.JSON(), nullable=False),
        sa.Column('ai_usage_log_id', sa.Integer(), sa.ForeignKey('ai_usage_logs.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── progression_feedback ─────────────────────────────────────────
    op.create_table(
        'progression_feedback',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('progression_reports.id'), nullable=True),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('suggestion_type', sa.String(), nullable=False),
        sa.Column('suggested_value', sa.JSON(), nullable=False),
        sa.Column('action', sa.String(), nullable=False, server_default='ignored'),
        sa.Column('applied_value', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── exercise_progressions ────────────────────────────────────────
    op.create_table(
        'exercise_progressions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('chain_name', sa.String(), nullable=False, index=True),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('target_reps_to_advance', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('target_sets_to_advance', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('sessions_to_advance', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('suggested_starting_sets', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('suggested_starting_reps', sa.String(), nullable=False, server_default='4-6'),
    )

    # ── Seed bodyweight chains ───────────────────────────────────────
    conn = op.get_bind()

    from app.progression_chains import CHAINS

    for chain_name, exercises in CHAINS.items():
        for position, (exercise_name, reps_adv, sets_adv, sess_adv, start_sets, start_reps) in enumerate(exercises):
            result = conn.execute(
                sa.text("SELECT id FROM exercises WHERE name = :name"),
                {"name": exercise_name},
            )
            row = result.fetchone()
            if row is None:
                # Exercise not in catalog — skip this chain entry
                continue

            conn.execute(
                sa.text(
                    "INSERT INTO exercise_progressions "
                    "(chain_name, exercise_id, position, target_reps_to_advance, "
                    "target_sets_to_advance, sessions_to_advance, "
                    "suggested_starting_sets, suggested_starting_reps) "
                    "VALUES (:chain, :eid, :pos, :reps, :sets, :sess, :ss, :sr)"
                ),
                {
                    "chain": chain_name,
                    "eid": row[0],
                    "pos": position,
                    "reps": reps_adv,
                    "sets": sets_adv,
                    "sess": sess_adv,
                    "ss": start_sets,
                    "sr": start_reps,
                },
            )


def downgrade() -> None:
    op.drop_table('exercise_progressions')
    op.drop_table('progression_feedback')
    op.drop_table('progression_reports')
