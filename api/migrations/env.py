from logging.config import fileConfig
import os

from alembic import context
from dotenv import dotenv_values
from sqlalchemy import engine_from_config, pool

from fintrack.db.meta import Base
from fintrack.db import models  # noqa: F401

config = context.config
file_environment = dotenv_values(".env")
database_url = (os.environ.get("DATABASE_URL") or file_environment.get("DATABASE_URL") or "sqlite:///./fin_track.db").replace("sqlite+aiosqlite", "sqlite")
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=connection.dialect.name == "sqlite")
        with context.begin_transaction():
            context.run_migrations()


run_migrations_offline() if context.is_offline_mode() else run_migrations_online()
