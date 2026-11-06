#!/usr/bin/env python
"""Check the manuscript against the Patterns Research Article requirements.

    python patterns_research_article/scripts/check_submission.py
"""
import re
import sys
from pathlib import Path

ART = Path(__file__).resolve().parents[1]
main = (ART / "main.tex").read_text()
sec = {p.stem: p.read_text() for p in (ART / "sections").glob("*.tex")}


def words(tex: str) -> int:
    t = re.sub(r"%.*", "", tex)
    t = re.sub(r"\\(begin|end)\{[^}]*\}", " ", t)
    t = re.sub(r"\\(cite|ref|label|eqref)\{[^}]*\}", " ", t)
    t = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", " ", t)
    t = re.sub(r"[{}$\\~^_]", " ", t)
    return len([w for w in t.split() if re.search(r"[A-Za-z0-9]", w)])


fails, warns = [], []


def check(ok, msg, warn=False):
    print(("PASS " if ok else ("WARN " if warn else "FAIL ")) + msg)
    if not ok:
        (warns if warn else fails).append(msg)


title = re.search(r"\\title\{(.*?)\}\s*\n\s*\n|\\title\{(.*?)\}\n", main, re.S)
t = re.sub(r"\s+", " ", re.search(r"\\title\{(.*?)\}", main, re.S).group(1))
check(len(t) <= 150, f"Title {len(t)} characters (<=150)")
summ = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", main, re.S).group(1)
check(words(summ) <= 150, f"Summary {words(summ)} words (<=150)")
check("\\cite" not in summ, "Summary has no citations")
check(summ.strip().count("\n\n") == 0, "Summary is one paragraph")
hl = re.findall(r"\\item (.*?)(?=\\item|\\end\{hlbox\})", re.search(r"\\begin\{hlbox\}(.*?)\\end\{hlbox\}", main, re.S).group(0) + "\\end{hlbox}", re.S)
hl = [re.sub(r"\s+", " ", h).strip() for h in hl]
check(3 <= len(hl) <= 4, f"Highlights: {len(hl)} bullets (3-4)")
for h in hl:
    check(len(h) <= 85, f"Highlight {len(h)} chars (<=85): {h}")
bp = re.search(r"\\begin\{biggerpicture\}(.*?)\\end\{biggerpicture\}", main, re.S).group(1)
check(words(bp) <= 300, f"The bigger picture {words(bp)} words (<=300)")
core = sum(words(sec[k]) for k in ("introduction", "results", "discussion"))
meth = words(sec["methods"])
check(core + meth <= 7500, f"Intro+Results+Discussion {core} words; with Methods {core + meth} (guide ~5,000-7,000)",
      warn=True)
order = [m.start() for m in (re.search(r"\\input\{sections/" + k + r"\}", main) for k in
                             ("introduction", "results", "discussion", "methods", "declarations"))]
check(order == sorted(order), "Section order Introduction > Results > Discussion > Methods > Resource availability")
for need in ("Lead contact", "Materials availability", "Data and code availability", "Author contributions",
             "Declaration of interests", "Declaration of generative AI"):
    check(need in sec["declarations"], f"Section present: {need}")
allt = "\n".join(sec.values())
first = []
for m in re.finditer(r"Figure~\\ref\{fig:fig(\d)\}", allt):
    if int(m.group(1)) not in first:
        first.append(int(m.group(1)))
check(first == sorted(first), f"Main figures first cited in order: {first}")
sfirst = []
for m in re.finditer(r"Figure~S(\d)", sec["results"] + sec["discussion"]):
    if int(m.group(1)) not in sfirst:
        sfirst.append(int(m.group(1)))
check(sfirst == sorted(sfirst), f"Supplementary figures first cited in order: {sfirst}", warn=True)
for f in [f"Figure{i}" for i in range(1, 7)] + [f"FigureS{i}" for i in range(1, 5)] + ["GraphicalAbstract"]:
    pdf = ART / "figures" / f"{f}.pdf"
    check(pdf.exists() and pdf.stat().st_size < 3e6, f"{f}.pdf present and < 3 MB")
    tif = ART / "figures" / f"{f}.tif"
    check(tif.exists() and tif.stat().st_size < 20e6, f"{f}.tif present and < 20 MB")
log = (ART / "main.log").read_text(errors="ignore") if (ART / "main.log").exists() else ""
check("undefined" not in log.lower(), "No undefined references or citations in main.log")
todos = re.findall(r"TODO\(author\)", main + allt)
check(not todos, f"{len(todos)} TODO(author) markers remain (author decisions)", warn=True)
check("6,745 patients" not in allt and "\\num{6745} patients" not in allt, "No '6,745 patients' claim")
print(f"\n{len(fails)} failures, {len(warns)} warnings")
sys.exit(1 if fails else 0)
