"""Renders the Banana Monkey icons and iPad/iPhone launch images from monkey.js.

Run from the repo root: python3 tools/make-icons.py  (needs: pip install playwright pillow && playwright install chromium)
"""
import pathlib, re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
LAUNCH = ICONS / "launch"
LAUNCH.mkdir(parents=True, exist_ok=True)
monkey_js = (ROOT / "monkey.js").read_text()
fonts = (ROOT / "fonts").as_uri()

ICON_HTML = f"""<html><body style="margin:0"><div id=i style="width:512px;height:512px;background:radial-gradient(circle at 50% 40%,#6fd394,#2f9e5b 60%,#1f7a43);display:flex;align-items:center;justify-content:center">
<div id=m style="width:420px;height:440px;margin-top:40px"></div></div><script>{monkey_js}
document.getElementById('m').innerHTML=monkeySVG('B','cheer').replace('<svg','<svg width=100% height=100%');</script></body></html>"""

LAUNCH_HTML = f"""<html><head><style>@font-face{{font-family:B;src:url({fonts}/baloo2-latin.woff2)}}
body{{margin:0;width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
background:radial-gradient(circle at 50% 40%,#6fd394 0%,#2f9e5b 55%,#1f7a43 100%);font-family:B;color:#fff}}
#m{{width:min(55vw,48vh);height:min(58vw,50vh)}} h1{{font-size:min(13vw,11vh);margin:0;line-height:1;text-shadow:0 .06em 0 #1f7a43}}
p{{font-size:min(5vw,4vh);margin:.2em 0 0;color:#ffd23f;font-weight:700}}</style></head><body><div id=m></div><h1>Kennedy 100</h1><p>with Banana Monkey</p>
<script>{monkey_js}document.getElementById('m').innerHTML=monkeySVG('A','wave').replace('<svg','<svg width=100% height=100%');</script></body></html>"""

index = (ROOT / "index.html").read_text()
sizes = sorted({tuple(map(int, m)) for m in re.findall(r"launch-(\d+)x(\d+)\.png", index)})

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 512, "height": 512})
    pg.set_content(ICON_HTML)
    for name, px in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
        pg2 = b.new_page(viewport={"width": 512, "height": 512}, device_scale_factor=px / 512)
        pg2.set_content(ICON_HTML)
        pg2.locator("#i").screenshot(path=str(ICONS / name))
        pg2.close()
    for w, h in sizes:
        dpr = 3 if min(w, h) in (1125, 1170, 1179, 1206, 1284, 1290, 1320) else 2
        lp = b.new_page(viewport={"width": w // dpr, "height": h // dpr}, device_scale_factor=dpr)
        lp.set_content(LAUNCH_HTML)
        lp.wait_for_timeout(150)
        lp.screenshot(path=str(LAUNCH / f"launch-{w}x{h}.png"))
        lp.close()
    b.close()

from PIL import Image  # shrink: launch gradients are huge as full-colour PNGs
for f in ICONS.rglob("*.png"):
    Image.open(f).convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)

svg = re.sub(r"\s+", " ", __import__("subprocess").run(["node", "-e", monkey_js + "process.stdout.write(monkeySVG('B','cheer'))"], capture_output=True, text=True).stdout)
(ROOT / "favicon.svg").write_text(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1) + "\n")
print("icons:", len(list(ICONS.glob('*.png'))), "launch:", len(list(LAUNCH.glob('*.png'))))
