"""초기 스키마 생성

Revision ID: 001
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """테이블 생성"""
    # users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("steam_id", sa.String(32), unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String(128), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # aim_dna_results
    op.create_table(
        "aim_dna_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("features", JSONB, nullable=False),
        sa.Column("type_label", sa.String(64), nullable=False, server_default="unknown"),
        sa.Column("analysis_version", sa.String(16), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # leaderboard_entries
    op.create_table(
        "leaderboard_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("stage_type", sa.String(64), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_leaderboard_stage_score", "leaderboard_entries", ["stage_type", "score"])
    op.create_index("idx_leaderboard_user_stage", "leaderboard_entries", ["user_id", "stage_type"])

    # crash_reports
    op.create_table(
        "crash_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("error_type", sa.String(64), nullable=False),
        sa.Column("error_message", sa.Text, nullable=False),
        sa.Column("stack_trace", sa.Text, nullable=True),
        sa.Column("context", JSONB, nullable=True),
        sa.Column("app_version", sa.String(16), nullable=False, server_default="0.1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # shared_contents
    op.create_table(
        "shared_contents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_type", sa.String(32), nullable=False),
        sa.Column("share_code", sa.String(16), unique=True, nullable=False, index=True),
        sa.Column("title", sa.String(128), nullable=False, server_default=""),
        sa.Column("data", JSONB, nullable=False),
        sa.Column("likes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("downloads", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_shared_type_likes", "shared_contents", ["content_type", "likes"])

    # session_uploads
    op.create_table(
        "session_uploads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("local_session_id", sa.Integer, nullable=False),
        sa.Column("session_data", JSONB, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    """테이블 삭제"""
    op.drop_table("session_uploads")
    op.drop_table("shared_contents")
    op.drop_table("crash_reports")
    op.drop_table("leaderboard_entries")
    op.drop_table("aim_dna_results")
    op.drop_table("users")
