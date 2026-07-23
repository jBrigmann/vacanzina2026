import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = Path("/sessions/wizardly-compassionate-mendel/mnt/Vacanze")
OUT_JSON = BASE_DIR / "data" / "routes.json"
OUT_JS = BASE_DIR / "js" / "routes.js"

NS = {"gpx": "http://www.topografix.com/GPX/1/1"}

# Filenames are numbered 01..07 and correspond 1:1 to trip days index 0..6
# (day 0 = 4 ago, ALESSANDRIA -> CERVIGNANO which also contains the
# CERVIGNANO -> AQUILEIA bike leg covered by file 01).
files = sorted(SRC_DIR.glob("*.gpx"))

routes = []
for f in files:
    tree = ET.parse(f)
    root = tree.getroot()

    name_el = root.find("gpx:metadata/gpx:name", NS)
    name = name_el.text if name_el is not None else f.stem

    waypoints = []
    for wpt in root.findall("gpx:wpt", NS):
        lat = float(wpt.get("lat"))
        lon = float(wpt.get("lon"))
        name_wpt_el = wpt.find("gpx:name", NS)
        waypoints.append({
            "lat": lat, "lon": lon,
            "name": name_wpt_el.text if name_wpt_el is not None else None,
        })

    track = []
    for trkpt in root.findall("gpx:trk/gpx:trkseg/gpx:trkpt", NS):
        lat = float(trkpt.get("lat"))
        lon = float(trkpt.get("lon"))
        track.append([round(lat, 6), round(lon, 6)])

    routes.append({
        "file": f.name,
        "name": name,
        "waypoints": waypoints,
        "track": track,
    })
    print(f.name, "-> waypoints:", len(waypoints), "track points:", len(track))

data = {"routes": routes}

OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_JSON, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False)

with open(OUT_JS, "w", encoding="utf-8") as fh:
    fh.write("window.TRIP_ROUTES = ")
    json.dump(data, fh, ensure_ascii=False)
    fh.write(";\n")

print("Wrote", OUT_JSON)
print("Wrote", OUT_JS)
