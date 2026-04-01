import os
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _import_module(module_name: str, env: dict[str, str]):
    script = (
        "import sys; "
        f"sys.path.insert(0, {str(BACKEND_DIR)!r}); "
        f"import {module_name}"
    )
    return subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        env=env,
        cwd=BACKEND_DIR,
    )


def test_secret_key_is_required_when_app_env_is_production():
    env = os.environ.copy()
    env["APP_ENV"] = "production"
    env["DATABASE_URL"] = "sqlite:///prod.db"
    env["OPENAI_API_KEY"] = "test-key"
    env.pop("SECRET_KEY", None)

    result = _import_module("app.auth", env)

    assert result.returncode != 0
    assert "SECRET_KEY must be set when APP_ENV=production" in (result.stdout + result.stderr)


def test_database_url_is_required_when_app_env_is_production():
    env = os.environ.copy()
    env["APP_ENV"] = "production"
    env["SECRET_KEY"] = "prod-secret"
    env["OPENAI_API_KEY"] = "test-key"
    env.pop("DATABASE_URL", None)

    result = _import_module("app.database", env)

    assert result.returncode != 0
    assert "DATABASE_URL must be set when APP_ENV=production" in (result.stdout + result.stderr)


def test_main_requires_openai_api_key_in_production():
    env = os.environ.copy()
    env["APP_ENV"] = "production"
    env["SECRET_KEY"] = "prod-secret"
    env["DATABASE_URL"] = "sqlite:///prod.db"
    env.pop("OPENAI_API_KEY", None)

    result = _import_module("app.main", env)

    assert result.returncode != 0
    assert "Missing required production environment variables: OPENAI_API_KEY" in (result.stdout + result.stderr)
