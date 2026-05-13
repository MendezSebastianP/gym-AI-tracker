"""dedupe sets + unique partial index

Revision ID: c3d4e5f6a7b8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-13 12:10:00.000000

Removes duplicate normal sets that share (session_id, exercise_id, set_number),
keeping the row with the highest id (most recent), then adds a partial
unique index to prevent the bug from recurring.

The partial filter excludes drop sets because a drop set legitimately shares
its set_number with the parent normal set.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        # Delete duplicates keeping the highest id (most recent insert).
        op.execute("""
            DELETE FROM sets s
            USING sets dup
            WHERE s.session_id = dup.session_id
              AND s.exercise_id = dup.exercise_id
              AND s.set_number = dup.set_number
              AND COALESCE(s.set_type, 'normal') = 'normal'
              AND COALESCE(dup.set_type, 'normal') = 'normal'
              AND s.id < dup.id;
        """)
        op.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_sets_session_exercise_setnumber
            ON sets (session_id, exercise_id, set_number)
            WHERE COALESCE(set_type, 'normal') = 'normal';
        """)
    else:
        # SQLite (tests) — same dedupe via correlated subquery, no partial index.
        op.execute("""
            DELETE FROM sets
            WHERE id NOT IN (
                SELECT MAX(id) FROM sets
                WHERE COALESCE(set_type, 'normal') = 'normal'
                GROUP BY session_id, exercise_id, set_number
            )
            AND COALESCE(set_type, 'normal') = 'normal';
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP INDEX IF EXISTS uq_sets_session_exercise_setnumber;")
