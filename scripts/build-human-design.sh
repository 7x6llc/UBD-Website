#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/tmp/open-human-design-ubd"
rm -rf "$SOURCE_DIR"
git clone --quiet https://github.com/Unforced-Dev/open-human-design.git "$SOURCE_DIR"
cd "$SOURCE_DIR"
git checkout --quiet d2d55083caca6ee7da190bdf1d9a08064cf6410b

python3 <<'PY'
from pathlib import Path
root=Path("/tmp/open-human-design-ubd")

p=root/"index.html"
s=p.read_text()
s=s.replace("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap","https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap")
s=s.replace("<title>Open Human Design — Free Interactive Chart</title>","<title>Human Design Report | Unbecoming By Design</title>")
s=s.replace('<span class="logo-text">Open HD</span>','<span class="logo-text">Human Design</span>')
s=s.replace("Free, accurate, private — your birth data never leaves this device","Free, accurate, private - your birth data stays on your device")
s=s.replace("from the moment you were born. Enter your details to see your free chart — no account needed.","from the moment you were born. Enter your details to see your free chart. No account required.")
s=s.replace("No account · no tracking · charts stay on your device","No Account required - the chart and birth data stay on your device.")
p.write_text(s)

css=root/"src/styles.css"
c=css.read_text()
c=c.replace("--accent: #c47a2a;","--accent: #21D4D8;")
c=c.replace("--accent-strong: #9a5e1c;","--accent-strong: #061431;")
c=c.replace("--accent-soft: #f5e6d0;","--accent-soft: #e5f7f5;")
c=c.replace("--accent-hover: #834e15;","--accent-hover: #262B33;")
c=c.replace("--font: 'Inter', system-ui, -apple-system, sans-serif;","--font: 'Montserrat', system-ui, -apple-system, sans-serif;")
c=c.replace("--font-serif: 'Crimson Pro', Georgia, serif;","--font-serif: 'Cormorant Garamond', Georgia, serif;")
c += """
/* Unbecoming By Design integration */
#sync-button, #sync-popover { display:none !important; }
:root { --max-width: 1120px; }
.header-inner { padding-left:16px; padding-right:16px; }
.chart-layout { grid-template-columns:minmax(340px,500px) minmax(0,1fr); gap:24px; padding-left:16px; padding-right:16px; }
.chart-column, .info-column, .panel-content, .bodygraph-container { min-width:0; max-width:100%; }
body { overflow-x:hidden; }
@media (max-width:900px) {
  .chart-layout { grid-template-columns:1fr; }
  .chart-column { position:static; max-height:none; overflow:visible; }
}
"""
css.write_text(c)
PY

npm ci --no-audit --no-fund
npm run build

cd "$OLDPWD"
rm -rf human-design
mkdir -p human-design
cp -R "$SOURCE_DIR/dist/." human-design/
