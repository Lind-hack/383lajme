$file = "C:\Users\PC1\Desktop\businesses\383\lib\mock-data.ts"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Article 1 currently 312 words, needs >=330 for 2 min
# New body starts with "Komisoni Evropian" (the one we wrote in fix_bodies.ps1)
$add1 = " Delegacioni i posaçëm i Parlamentit Europian per Ballkanin Perendimor ka planifikuar vizite pune ne Pristine ku do te diskutohet ecurina e reformave dhe angazhimet e dakorduar ne raportin e fundit. Ekspertet europiane te integrimit vleresojne se me nje angazhim te qendrueshëm institucional dhe civil, Kosova ka kapacitetin real per te arritur progres te matshëm brenda katër viteve te ardhshme ne te gjitha kriteret kryesore te anetaresimit ne Bashkimin Europian."

# Article 5 currently 270 words, needs >=330 for 2 min
# New body starts with "Futbollistet e kombetares"
$add5 = " Klube te njohura europiane kane shfaqur interes konkret per disa lojtare te kombetares kosovare pas performances se shkëlqyer te demonstruar ne kete ndeshje. Drejtuesit e Federates se Futbollit te Kosoves jane ne bisedime me UEFA-n per rritjen e numrit te ndeshjeve shtepie ne Pristine dhe per permiresimin e infrastrukturës se stadiumit kombëtar per te arritur kapacitetin e nevojshem per ndeshjet e kalibrit te larte europian. Fansat kosovar ne diapora ndoqen ndeshjen me entuziazem te madh ne kafe dhe bare ne Gjermani Zvicër dhe Austri duke e bere kete me teper se nje fitore sportive."

# Article 1: find current body (starts with "Komisoni Evropian") and append
# The body ends with "...opinionit publik." followed by backtick
$content = [regex]::Replace($content, '(body: `[^`]*Komisoni Evropian[^`]*)(opinionit publik\.)`', "`$1opinionit publik.$add1``")

# Article 5: find current body (starts with "Futbollistet e kombetares") and append
$content = [regex]::Replace($content, '(body: `[^`]*Futbollistet e kombetares[^`]*)(vitet qe vijne\.)`', "`$1vitet qe vijne.$add5``")

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Output "Done supplementing articles 1 and 5."

# Verify
$b1check = [regex]::Match($content, 'body: `([^`]*Komisoni Evropian[^`]*)`').Groups[1].Value
$b5check = [regex]::Match($content, 'body: `([^`]*Futbollistet e kombetares[^`]*)`').Groups[1].Value
$w1 = ($b1check.Trim() -split '\s+' | Where-Object { $_ }).Count
$w5 = ($b5check.Trim() -split '\s+' | Where-Object { $_ }).Count
$m1 = [Math]::Max(1, [Math]::Round($w1 / 220))
$m5 = [Math]::Max(1, [Math]::Round($w5 / 220))
Write-Output "Article1(BE): $w1 words -> $m1 min"
Write-Output "Article5(sport): $w5 words -> $m5 min"
