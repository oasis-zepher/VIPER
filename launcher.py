#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
launcher.py -- VIPER standalone launcher
PyInstaller entry point. Runs Streamlit directly in-process.
"""

from __future__ import annotations

import os
import sys
import socket
import threading
import time
import webbrowser
from pathlib import Path


def get_app_root() -> Path:
    """Get application root (supports PyInstaller _MEIPASS)."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent


def get_user_data_dir() -> Path:
    """Get persistent user data directory."""
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    data_dir = base / "VIPER"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def find_free_port(start: int = 8501, end: int = 8599) -> int:
    """Find an available port."""
    for port in range(start, end):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    return start


def wait_and_open_browser(port: int, timeout: float = 60.0) -> None:
    """Wait for server to start, then open browser."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                s.connect(("127.0.0.1", port))
                url = f"http://localhost:{port}"
                print(f"[OK] Opening browser: {url}")
                webbrowser.open(url)
                return
        except (ConnectionRefusedError, OSError):
            time.sleep(0.5)
    print(f"[WARN] Server timeout. Open http://localhost:{port} manually")


def setup_environment(app_root: Path, user_data: Path) -> None:
    """Configure environment variables."""
    os.environ["VIPER_APP_ROOT"] = str(app_root)
    os.environ["VIPER_USER_DATA"] = str(user_data)

    # .env file in user data directory
    user_env_file = user_data / ".env"
    if user_env_file.exists():
        os.environ["DOTENV_PATH"] = str(user_env_file)

    # Default project directory
    projects_dir = user_data / "projects"
    projects_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("DEFAULT_PROJECT_ROOT", str(projects_dir))


def create_streamlit_config(user_data: Path, port: int) -> Path:
    """Generate Streamlit config file."""
    config_dir = user_data / ".streamlit"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_file = config_dir / "config.toml"

    config_content = f"""\
[global]
developmentMode = false

[server]
port = {port}
headless = true
enableCORS = false
enableXsrfProtection = false
maxUploadSize = 2000

[browser]
gatherUsageStats = false

[theme]
primaryColor = "#4CAF50"
backgroundColor = "#0E1117"
secondaryBackgroundColor = "#262730"
textColor = "#FAFAFA"
font = "sans serif"
"""
    config_file.write_text(config_content, encoding="utf-8")
    return config_dir


def main() -> None:
    """VIPER main entry point."""
    print("=" * 50)
    print("  VIPER - Bioinformatics AI Agent")
    print("  Starting up...")
    print("=" * 50)

    app_root = get_app_root()
    user_data = get_user_data_dir()
    port = find_free_port()

    # Setup
    config_dir = create_streamlit_config(user_data, port)
    setup_environment(app_root, user_data)

    # Set Streamlit config dir
    os.environ["STREAMLIT_CONFIG_DIR"] = str(config_dir)
    # Force production mode (PyInstaller frozen)
    os.environ["STREAMLIT_GLOBAL_DEVELOPMENT_MODE"] = "false"

    # Verify app.py exists
    app_py = app_root / "app.py"
    if not app_py.exists():
        print(f"[ERROR] Cannot find {app_py}")
        input("Press Enter to exit...")
        sys.exit(1)

    print(f"[*] Starting Streamlit on port {port} ...")
    print(f"[*] User data: {user_data}")
    print("[*] Press Ctrl+C to exit.\n")

    # Background thread to open browser once server is ready
    browser_thread = threading.Thread(
        target=wait_and_open_browser, args=(port,), daemon=True
    )
    browser_thread.start()

    # Run Streamlit directly in-process (no subprocess needed)
    sys.argv = [
        "streamlit", "run", str(app_py),
        "--server.port", str(port),
        "--server.headless", "true",
        "--browser.gatherUsageStats", "false",
    ]

    try:
        from streamlit.web.cli import main as st_main
        st_main()
    except KeyboardInterrupt:
        print("\n[*] VIPER shutting down...")
    except Exception as e:
        print(f"[ERROR] {e}")
        input("Press Enter to exit...")
        sys.exit(1)


if __name__ == "__main__":
    main()
