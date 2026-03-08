"""add events_sample to analysis_results

Revision ID: add_events_sample
Revises: 845e7b166d19
Create Date: 2026-03-07

"""
from alembic import op
import sqlalchemy as sa

revision = "add_events_sample"
down_revision = "845e7b166d19"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("analysis_results", sa.Column("events_sample", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("analysis_results", "events_sample")
