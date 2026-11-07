import os
from pathlib import Path
from typing import Any, Dict
try:
    import yaml
except ImportError:
    yaml = None

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent
WORK_DIR = BASE_DIR / "work"
OUT_DIR = BASE_DIR / "out"
STATE_DIR = BASE_DIR / "state"

# Ensure runtime directories exist
WORK_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)
STATE_DIR.mkdir(parents=True, exist_ok=True)


def load_env_file():
    """Simple .env parser to avoid heavy external dependencies if uninstalled."""
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val


load_env_file()

# Environment settings
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:3000").rstrip("/")
AGENT_KEY = os.environ.get("AGENT_KEY", "agk_test_secret_key_123")
PRINTER_NAME = os.environ.get("PRINTER_NAME", "ShopPrinter")
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "3"))
HEARTBEAT_SECONDS = int(os.environ.get("HEARTBEAT_SECONDS", "15"))
PRINT_DRY_RUN = os.environ.get("PRINT_DRY_RUN", "true").lower() in ("true", "1", "yes")

# Load agent-config.yaml
CONFIG_PATH = BASE_DIR / "agent-config.yaml"
YAML_CONFIG: Dict[str, Any] = {}
if CONFIG_PATH.exists() and yaml is not None:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            YAML_CONFIG = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"[Config] Warning: Failed to parse agent-config.yaml: {e}")

CUPS_OPTIONS = YAML_CONFIG.get("cups_options", {})
SUMATRA_OPTIONS = YAML_CONFIG.get("sumatra_options", {})
