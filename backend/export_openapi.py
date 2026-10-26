"""OpenAPI スキーマを標準出力に書き出す（npm run gen:api から使う。環境変数は不要）"""

import json
import sys

from backend.app import create_app


def main() -> None:
    json.dump(create_app().openapi(), sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
