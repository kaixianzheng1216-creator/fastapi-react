from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.core.config import settings
from app.db.models import metadata

# 这是 Alembic 的 Config 对象，
# 用于访问当前使用的 .ini 配置文件中的配置项。
config = context.config

# 解析配置文件中的 Python 日志配置。
# 这一行主要用于初始化日志记录器。
assert config.config_file_name is not None
fileConfig(config.config_file_name)

# 在这里添加模型的 MetaData 对象，
# 以支持自动生成迁移文件（autogenerate）。
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
# target_metadata = None

target_metadata = metadata

# env.py 所需的其他配置值也可以在这里获取：
# my_important_option = config.get_main_option("my_important_option")
# ……等等。


def get_url():
    return str(settings.SQLALCHEMY_DATABASE_URI)


def run_migrations_offline():
    """以"离线"模式运行迁移。

    此模式下仅用 URL 配置上下文，
    不创建 Engine（不过 Engine 也可以用）。
    跳过 Engine 创建意味着不需要 DBAPI 可用。

    调用 context.execute() 会将给定字符串输出到脚本输出。

    """
    url = get_url()
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """以"在线"模式运行迁移。

    此模式下需要创建 Engine，
    并将一个连接关联到上下文。

    """
    configuration = config.get_section(config.config_ini_section)
    assert configuration is not None
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
