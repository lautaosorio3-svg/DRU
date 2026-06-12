#!/usr/bin/env python3
"""Parse efemérides .docx files from Archivo General de Entre Ríos into JSON."""
import os, re, json, subprocess, sys

BASE = "/Users/losorio/Library/CloudStorage/OneDrive-EDITORIALDIARIOLACAPITALSA/Escritorio Casa/DRU/archivo"
MONTHS = {
    "Enero":1,"Febrero":2,"Marzo":3,"Abril":4,"Mayo":5,"Junio":6,
    "Julio":7,"Agosto":8,"Septiembre":9,"Octubre":10,"Noviembre":11,"Diciembre":12
}

DAY_RE = re.compile(r'SUCEDI[OÓÒ]\s+UN\s+(\d+)[ºª°]?\s+DE\s+(\w+)', re.IGNORECASE)
YEAR_RE = re.compile(r'^(\d{4})\s*$')

def extract_text(path):
    r = subprocess.run(['textutil', '-convert', 'txt', '-stdout', path], capture_output=True, text=True)
    return r.stdout

def parse_file(path, month_num):
    text = extract_text(path)
    if not text.strip():
        return []

    fname = os.path.basename(path)
    dm = DAY_RE.search(fname)
    if not dm:
        dm = DAY_RE.search(text[:200])
    if not dm:
        return []

    day = int(dm.group(1))

    lines = text.split('\n')
    entries = []
    current_year = None
    current_title = None
    current_desc_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Skip header line and footer
        if DAY_RE.match(stripped):
            continue
        if stripped.startswith('©') or stripped.startswith('http') or stripped.startswith('Imágenes:') or stripped.startswith('Imagen:'):
            continue
        if '- ' == stripped[:2] and current_year and len(current_desc_lines) > 0 and any(kw in stripped.lower() for kw in ['diario', 'foto', 'imagen', 'artículo', 'periódico']):
            continue

        ym = YEAR_RE.match(stripped)
        if ym:
            # Save previous entry
            if current_year and current_title:
                desc = ' '.join(current_desc_lines).strip()
                # Truncate very long descriptions
                if len(desc) > 500:
                    desc = desc[:497] + '...'
                entries.append({
                    "d": day,
                    "m": month_num,
                    "y": current_year,
                    "title": current_title,
                    "desc": desc,
                    "city": "Entre Ríos",
                    "cats": ["hist"]
                })
            current_year = int(ym.group(1))
            current_title = None
            current_desc_lines = []
        elif current_year and not current_title:
            current_title = stripped
            current_desc_lines = []
        elif current_year and current_title:
            current_desc_lines.append(stripped)

    # Save last entry
    if current_year and current_title:
        desc = ' '.join(current_desc_lines).strip()
        if len(desc) > 500:
            desc = desc[:497] + '...'
        entries.append({
            "d": day,
            "m": month_num,
            "y": current_year,
            "title": current_title,
            "desc": desc,
            "city": "Entre Ríos",
            "cats": ["hist"]
        })

    return entries

all_entries = []
for month_name, month_num in sorted(MONTHS.items(), key=lambda x: x[1]):
    month_dir = os.path.join(BASE, month_name)
    if not os.path.isdir(month_dir):
        print(f"  ⚠ No encontrado: {month_name}", file=sys.stderr)
        continue

    docx_files = sorted([f for f in os.listdir(month_dir) if f.lower().endswith('.docx')])
    for fname in docx_files:
        path = os.path.join(month_dir, fname)
        entries = parse_file(path, month_num)
        all_entries.extend(entries)
        if entries:
            print(f"  ✓ {fname}: {len(entries)} efemérides", file=sys.stderr)
        else:
            print(f"  ⚠ {fname}: sin efemérides parseables", file=sys.stderr)

# Assign IDs
for i, e in enumerate(all_entries):
    e["id"] = i + 1

print(f"\n  Total: {len(all_entries)} efemérides procesadas", file=sys.stderr)

out_path = "/Users/losorio/Documents/DRU EDITORIAL CLAUDE/dru-editorial/efemerides.json"
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_entries, f, ensure_ascii=False, indent=None, separators=(',', ':'))

print(f"  Guardado en: {out_path}", file=sys.stderr)
