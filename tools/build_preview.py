"""Empaqueta la app en un único HTML (CSS y JS en línea) para vistas previas.

Uso: python3 tools/build_preview.py <carpeta_salida>
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def strip_module(src: str) -> str:
    src = re.sub(r"^import .*?;\n", "", src, flags=re.M)
    return re.sub(r"^export (const|function|async function)", r"\1", src, flags=re.M)


def main(out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    css = (ROOT / "styles.css").read_text()
    js = "\n".join(strip_module((ROOT / "js" / f).read_text()) for f in ("seed.js", "store.js", "app.js"))
    body = (ROOT / "index.html").read_text()
    body = body[body.index("<body>") + len("<body>"):body.index("</body>")]
    html = (
        "<title>Sushi Counter</title>\n"
        '<meta name="claude:viewport-fit-sides" content="cover">\n'
        f"<style>\n{css}\n</style>\n"
        f"{body.strip()}\n"
        f"<script>\n(() => {{\n{js}\n}})();\n</script>\n"
    )
    (out / "sushi-counter.html").write_text(html)
    print(out / "sushi-counter.html", len(html), "bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "dist")
