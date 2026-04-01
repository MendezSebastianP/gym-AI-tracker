import os
import sys


_PRODUCTION_ENVS = {"production", "prod"}
_TEST_ENVS = {"test", "testing"}


def app_env() -> str:
    return (
        os.getenv("APP_ENV")
        or os.getenv("ENV")
        or os.getenv("PYTHON_ENV")
        or "development"
    ).strip().lower()


def is_test_env() -> bool:
    return "pytest" in sys.modules or app_env() in _TEST_ENVS


def is_production_env() -> bool:
    return app_env() in _PRODUCTION_ENVS


def get_env(name: str, default: str | None = None, *, required_in_production: bool = False) -> str | None:
    value = os.getenv(name)
    if value is not None:
        value = value.strip()
        if value:
            return value
    if required_in_production and is_production_env():
        raise RuntimeError(f"{name} must be set when APP_ENV=production")
    return default


def get_csv_env(name: str) -> set[str]:
    raw = os.getenv(name, "")
    return {
        item.strip().lower()
        for item in raw.split(",")
        if item.strip()
    }


def validate_production_environment() -> None:
    if not is_production_env():
        return

    missing = [
        key for key in ("SECRET_KEY", "DATABASE_URL", "OPENAI_API_KEY")
        if not os.getenv(key, "").strip()
    ]
    if missing:
        raise RuntimeError(
            "Missing required production environment variables: " + ", ".join(missing)
        )
