"""requirements.txt（Vercel 用）と pyproject.toml の依存が一致していることを検証する"""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_requirements_txtとpyprojectの依存が一致する() -> None:
    pyproject = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    lines = (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
    requirements = [line.strip() for line in lines if line.strip() and not line.startswith("#")]
    assert sorted(requirements) == sorted(pyproject["project"]["dependencies"])
