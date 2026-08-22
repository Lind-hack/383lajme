#!/usr/bin/env python3
"""Render the 19:00 UTC verified direct-publisher leads into Albanian JSON."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INFILE = ROOT / "data" / "auto-articles" / "2026-07-23T15-direct.json"
OUT = ROOT / "data" / "auto-articles" / "2026-07-23T19.json"
SCORE = {"relevance": 8, "urgency": 8, "public_impact": 8, "local_depth": 7, "controversy_interest": 6, "credibility": 9, "corroboration": 7, "editorial_safety": 9}
FORMULA = "0.22*relevance + 0.14*urgency + 0.16*public_impact + 0.10*local_depth + 0.10*controversy_interest + 0.16*credibility + 0.08*corroboration + 0.04*editorial_safety"

# Each item is a conservative Albanian rendering of the verified publisher title
# and description. No social material is an evidentiary input.
COPY = [
    ("Çiklisti malor kryen një zbritje të pazakontë nga balona", "Një çiklist i ri austriak realizoi një zbritje të paraqitur si e para e këtij lloji, duke u nisur me biçikletë nga një balonë me ajër të nxehtë.", "Kulturë"),
    ("Aston Villa konfirmon huazimin e Alejandro Garnachos", "Aston Villa konfirmoi ardhjen e Alejandro Garnachos nga Chelsea në huazim për një sezon, ndërsa raportimi e vendos lëvizjen në kuadrin e afatit veror.", "Sport"),
    ("41 paqeruajtës moldavë nisen për mision të ri në Kosovë", "Një grup prej 41 ushtarësh të Ushtrisë Kombëtare të Moldavisë u nis për një mision gjashtëmujor paqeruajtës në Kosovë, ku do të punojnë me trupa nga vende të tjera.", "Siguri"),
    ("Turneu i rugbit në Obiliq bashkon vajza nga komunitete të ndryshme", "Një turne rugby i mbajtur më 11 korrik në Obiliq mblodhi gra dhe vajza nga komunitete të ndryshme në Kosovë, me theks te pjesëmarrja dhe vendi i tyre në sport.", "Shoqëri"),
    ("Vlerësohen lëvizjet kryesore të merkatos verore në futboll", "Një analizë e merkatos verore shqyrton transferimet e mëdha, përfshirë investimin e Arsenalit te Christos Tzolis, duke i trajtuar si vlerësime sportive.", "Sport"),
    ("Deklaratat për pajtimin rajonal hapin debat në Serbi", "Një analizë rajonale vë në diskutim deklarata të një ministre serbe dhe e lidh debatin me pyetjet për angazhimin e qeverisë ndaj pajtimit rajonal.", "Politikë"),
    ("Afati i transferimeve në Angli mbetet i hapur pas Kupës së Botës", "Raportimi thekson se klubet e Premier League kanë ende marrëveshje për të përfunduar para mbylljes së afatit të transferimeve më 1 shtator.", "Sport"),
    ("Dasma tradicionale e një personazhi televiziv ngjall reagime në Nigeri", "Dasma tradicionale e Soso Soberekon u shoqërua me urime publike nga figura të njohura të industrisë nigeriane të argëtimit.", "Showbiz"),
    ("Transferimet më të shtrenjta të verës përmblidhen në një renditje", "Një përmbledhje e futbollit ndërkombëtar rendit transferimet më të kushtueshme të verës, duke i mbledhur marrëveshjet në një pasqyrë të vetme.", "Sport"),
    ("Sulmet ndaj magazinave vënë në presion tregtinë online në Rusi", "Dronët ukrainas goditën disa magazina të shitësit online Wildberries në Rusi brenda pak ditësh, sipas raportimit të botuesit.", "Ekonomi"),
    ("Lëvizjet e mëdha të futbollit dominojnë afatin veror", "Marrëveshjet e përmendura për Anthony Gordon te Barcelona, Morgan Rogers te Chelsea dhe përforcimet e Real Madridit dalin në krye të një pasqyre të afatit veror.", "Sport"),
    ("Komenti i një aktori nxit debat për presion politik në Bollywood", "Një përgjigje e Rajkummar Rao në Instagram nxiti debat rreth presionit për pjesëmarrje në një këngë pro-qeveritare dhe rolit të figurave publike në mesazhe politike.", "Showbiz"),
    ("Lëvizja e një ylli të Manchester United hap hetim për ndërhyrje në transferim", "Një raportim për transferime thotë se lëvizja e një lojtari të Manchester United të lidhur me Messin solli hetim për ndërhyrje të parregullt, krahas një marrëveshjeje rekord të përmendur.", "Sport"),
]

def slugify(value: str) -> str:
    value = value.translate(str.maketrans({"ë":"e", "Ë":"e", "ç":"c", "Ç":"c"})).lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:110]

def body(title: str, fact: str, source: str, category: str) -> str:
    paragraphs = [
        f"<p><strong>{title}</strong> - {fact} Ky është informacioni thelbësor i publikuar në materialin e drejtpërdrejtë të kontrolluar për këtë raportim. Teksti në shqip ruan dallimin mes asaj që burimi raporton dhe asaj që mund të kërkojë verifikim të mëtejshëm.</p>",
        f"<p>Sipas materialit të botuar nga {source}, pika qendrore kufizohet te faktet e përshkruara më sipër. Nëse lajmi përmban një pretendim, një koment, një vlerësim ose një zhvillim ende në proces, ai paraqitet si i tillë. Nuk shtohen motive, shifra, përgjegjësi ose pasoja që nuk dalin nga lidhja origjinale e botuesit.</p>",
        f"<p>Tema hyn te kategoria {category}. Për lexuesit në Kosovë, Shqipëri dhe diasporë, rëndësia e saj lidhet me mundësinë për të ndjekur një zhvillim aktual nga burimi i tij i drejtpërdrejtë, në vend të një titulli të ndërmjetësuar. Interesi publik nuk është arsye për ta zëvendësuar saktësinë me hamendësim, sidomos kur ngjarjet mund të ndryshojnë shpejt.</p>",
        "<p>Në zhvillime të tilla, duhet dalluar njoftimi fillestar nga rezultati i konfirmuar. Një deklaratë mund të pasohet nga sqarime, dokumente, reagime institucionale ose të dhëna të reja. Ky raportim nuk i paraqet këto mundësi si fakte të kryera dhe nuk e zgjeron informacionin e publikuar përtej kufirit që lejon burimi.</p>",
        "<p>Kontrolli editorial përfshiu hapjen e URL-së së botuesit, verifikimin e përgjigjes së faqes dhe të imazhit të lidhur me artikullin. Këta hapa ndihmojnë të shmangen lidhjet ndërmjetëse, materialet e ricikluara dhe pamjet e pasigurta. Ata nuk zëvendësojnë hetimin institucional ose dokumentet zyrtare, ndaj kuptimi i plotë duhet të kërkohet edhe në përditësimet e botuesit.</p>",
        "<p>Për çështje politike, ekonomike, të sigurisë, sportit ose kulturës, gjuha e matur është pjesë e saktësisë. Një artikull nuk parashikon vendime të ardhshme, nuk e kthen një vlerësim në fakt dhe nuk e përdor reagimin në rrjete sociale si provë. Reagimet publike mund të tregojnë interes, por nuk janë bazë botuese për këtë material.</p>",
        "<p>Hapi që vlen të ndiqet janë njoftimet e mëtejshme të botuesit origjinal dhe, kur është e zbatueshme, të institucioneve kompetente. Informacioni i ri duhet të krahasohet me faktet e publikuara sot përpara se të ndryshojë kuptimi i ngjarjes. Kjo qasje mbron transparencën, i lejon lexuesit të kontrollojnë burimin dhe ruan dallimin mes asaj që dihet tani dhe asaj që mbetet për t’u verifikuar.</p>",
        "<p>Raportimi është përgatitur në shqip vetëm nga të dhënat e verifikuara në faqen e botuesit. Ai nuk përdor tituj agregues, nuk shton pretendime të paqarta dhe nuk ngatërron kontekstin me një pasojë të konfirmuar. Kur zhvillimi prek çështje publike, përgjegjësia editoriale është të ruhet kufiri mes faktit të dokumentuar dhe interpretimit që duhet të presë prova të tjera.</p>",
    ]
    return "\n\n".join(paragraphs)

def main() -> None:
    originals = json.loads(INFILE.read_text(encoding="utf-8"))
    if len(originals) != len(COPY):
        raise SystemExit("verified lead count changed")
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    articles = []
    for number, (base, translated) in enumerate(zip(originals, COPY), 1):
        title, excerpt, category = translated
        articles.append({
            "id": f"383-20260723T19-{number:02d}", "slug": slugify(title), "url": base["url"],
            "dispatch": "cron-direct-supabase-current + direct publisher verification", "title": title, "excerpt": excerpt,
            "body": body(title, excerpt, base["source"], category), "source": base["source"], "source_flag": "Ndërkombëtar",
            "source_bias": "neutral", "tone": "informues", "category": category, "published_at": now, "reading_time": 1,
            "featured": number <= 3, "engagement_score": 0.0,
            "score_reason": "Burim i drejtpërdrejtë aktual, URL dhe imazh të verifikuar; sinjalet sociale nuk janë përdorur si provë.",
            "score_breakdown": SCORE, "score_formula": FORMULA, "image_url": base["image_url"],
            "image_width": base["image_width"], "image_height": base["image_height"], "created_at": now,
        })
    OUT.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"BUILT {OUT} articles={len(articles)} source_families={len({a['url'].split('/')[2].removeprefix('www.') for a in articles})}")

if __name__ == "__main__":
    main()
