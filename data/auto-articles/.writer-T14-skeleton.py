#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Writer for data/auto-articles/2026-08-23T14.json — GPT-5.6 Terra editorial batch.
All facts, figures and quotes verified directly on the cited publisher pages on 2026-08-23.
"""
import json

ARTICLES = []

# ---------------------------------------------------------------- 1. Kosovo-relevant: US visa ruling (BGNES)
ARTICLES.append({
    "id": "383-20260823T14-01",
    "slug": "gjykata-amerikane-anullon-ndalimin-e-visave-per-75-vende-ne-to-kosova-dhe-shqiperia",
    "url": "http://www.bgnes.com/society/us-court-overturns-suspension-of-immigrant-visa-processing-for-75-countries-including-kosovo-and-bosnia-and-herzegovina",
    "title": "Gjykata amerikane anullon ndalimin e visave për 75 vende, përfshirë Kosovën dhe Shqipërinë",
    "excerpt": "Gjyqtarja Jeanette Vargas e shpall vendimin e administratës «të paligjshëm» dhe konstaton se sekretari Rubio i ka tejkaluar autoritetet; vendimi mund të apelohet.",
    "body": (
        "<p>Një gjykatë federale amerikane ka anulluar vendimin e administratës që nga janari ndalte përpunimin e visave të imigrimit për shtetasit e 75 vendeve, mes tyre Kosova, Shqipëria, Maqedonia e Veriut, Mali i Zi dhe Bosnja dhe Hercegovina. Raporton agjencia bullgare BGNES.</p>"
        "<p>Gjyqtarja Jeanette Vargas e Gjykatës Districtale të Shteteve të Bashkuara për Distriktin Jugor të Nju Jorkut e vlerësoi vendimin si «të paligjshëm» dhe konstatoi se sekretari i Shtetit Marco Rubio i kishte tejkaluar autoritetet kur e miratoi atë. Sipas vendimit, nëpunësit konsularë ishin udhëzuar në mënyrë të paligjshme t’u mohonin visat shtetasve vetëm në bazë të vendit të origjinës.</p>"
        "<p>Vendimi hyri në fuqi në janar, kur Departamenti i Shtetit njoftoi se përpunimi i visave do të pezullohej me argumentin se imigrantët nga këto vende marrin një nivel «të papranueshëm të lartë» përfitimesh sociale nga tatimpaguesit amerikanë. Lista përfshinte edhe Afganistanin, Egjiptin, Brazilin, Irakun, Nigerinë, Somaliën, Tajlandën dhe Jemenin, transmeton RFE/RL sipas raportimit të agjencisë.</p>"
        "<p>Masa ishte paraprirë më 4 janar nga një listë që presidenti Donald Trump publikoi në Truth Social me vende, shtetasve të të cilave, sipas pretendimit të tij, u jepnin përfitime sociale. Në atë postim thoshte se 46 për qind e imigrantëve nga Kosova në Shtetet e Bashkuara marrin përfitime nga shteti — shifër që i atribuohet postimit dhe nuk është vërtetuar ndaras.</p>"
        "<p>Administrata mund të apeloje vendimin e gjykatës federale. Për qindra familje në rajon që pretendojnë ribashkim familjar në Shtetet e Bashkuara, vendimi i së dielës rikthen procedurën e pezulluar dhe hap një betej të re juridike rreth politikave të administratës ndaj imigrimit ligjor.</p>"
        "<para></para>"
    ),
})

with open("/opt/data/workspaces/383lajme/data/auto-articles/2026-08-23T14.json", "w", encoding="utf-8") as f:
    json.dump(ARTICLES, f, ensure_ascii=False, indent=2)
print("draft skeleton saved")
