
"""remove id index

Revision ID: 2c19b939304d
Revises: 1735df344f98
Create Date: 2026-11-05 15:14:38.988669

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c19b939304d'
down_revision: Union[str, Sequence[str], None] = '1735df344f98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index('ix_biorhythm_cache_id', table_name='biorhythm_cache')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_index(
        'ix_biorhythm_cache_id',
        'biorhythm_cache',
        ['id'],
        unique=False
    )
