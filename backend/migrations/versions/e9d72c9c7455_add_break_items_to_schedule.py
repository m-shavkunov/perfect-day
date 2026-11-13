"""add break items to schedule

Revision ID: e9d72c9c7455
Revises: 48c550c168e3
Create Date: 2026-11-13 22:57:20.192012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9d72c9c7455'
down_revision: Union[str, Sequence[str], None] = '48c550c168e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'schedule_items',
        sa.Column('item_type', sa.String(), nullable=False)
    )

    op.alter_column(
        'schedule_items',
        'task_id',
        existing_type=sa.INTEGER(),
        nullable=True
    )

    op.create_check_constraint(
        'ck_schedule_items_type_task',
        'schedule_items',
        "(item_type = 'task' AND task_id IS NOT NULL) OR "
        "(item_type = 'break' AND task_id IS NULL)"
    )


def downgrade() -> None:
    op.drop_constraint(
        'ck_schedule_items_type_task',
        'schedule_items',
        type_='check'
    )

    op.alter_column(
        'schedule_items',
        'task_id',
        existing_type=sa.INTEGER(),
        nullable=False
    )

    op.drop_column('schedule_items', 'item_type')
