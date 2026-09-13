#!/usr/bin/env python3
"""Chuyển markdown có mermaid -> docx: render mermaid thành PNG rồi gọi pandoc."""
import re, subprocess, sys, os, pathlib

src = pathlib.Path(sys.argv[1])
out_docx = pathlib.Path(sys.argv[2])
work = pathlib.Path(sys.argv[3])
work.mkdir(parents=True, exist_ok=True)
img_dir = work / "img"
img_dir.mkdir(exist_ok=True)

text = src.read_text(encoding="utf-8")
pattern = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)

blocks = pattern.findall(text)
print(f"Tìm thấy {len(blocks)} sơ đồ mermaid")

paths = []
for i, code in enumerate(blocks, 1):
    mmd = img_dir / f"diagram-{i:02d}.mmd"
    png = img_dir / f"diagram-{i:02d}.png"
    mmd.write_text(code, encoding="utf-8")
    r = subprocess.run(
        ["mmdc", "-i", str(mmd), "-o", str(png), "-b", "white", "-s", "3",
         "--puppeteerConfigFile", str(work / "pptr.json")],
        capture_output=True, text=True)
    if r.returncode != 0 or not png.exists():
        print(f"  ! sơ đồ {i} lỗi: {r.stderr.strip()[:300]}")
        paths.append(None)
    else:
        print(f"  ok sơ đồ {i} -> {png.name}")
        paths.append(png)

idx = iter(range(len(blocks)))
def repl(m):
    i = next(idx)
    p = paths[i]
    if p is None:
        return "```\n" + m.group(1) + "```"
    return f"![Sơ đồ {i+1}]({p})"

converted = pattern.sub(repl, text)
md_tmp = work / (src.stem + "-converted.md")
md_tmp.write_text(converted, encoding="utf-8")

cmd = ["pandoc", str(md_tmp), "-o", str(out_docx),
       "--from", "gfm+tex_math_dollars", "--toc", "--toc-depth=3",
       "--resource-path", str(work)]
ref = work / "reference.docx"
if ref.exists():
    cmd += ["--reference-doc", str(ref)]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print("pandoc lỗi:", r.stderr[:2000]); sys.exit(1)
print("Đã tạo:", out_docx, f"({out_docx.stat().st_size/1024:.0f} KB)")
