$file = "C:\Users\PC1\Desktop\businesses\383\lib\mock-data.ts"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Article 1 - BE raport - still has original short body, needs >=330 words
# Unique anchor: slug "kosova-be-raport-2025" ... body: `Komisioni Evropian`
$b1 = "Komisioni Evropian ka publikuar raportin vjetor te progresit per Kosoven, duke vleresuar ne menyre gjitheperfshines ecurine e reformave ne te gjithe fushat kryesore te integrimit europian. Dokumenti i zgjeruar perfshin analiza te detajuara mbi sektoret e drejtesise, luften kunder korrupsionit, lirite themelore dhe te drejtat e komuniteteve ne te gjitha dimensionet e tyre. Vleresimi pozitiv per zbatimin e marreveshjes bazike me Serbine dhe per reformat gjyqesore pershkruhet si arritja kryesore e periudhes se fundit. Komisioni veçon permiresimin e efikasitetit te sistemit te drejtesise si hap kritik drejt standardeve europiane te shtetet aspirante per anetaresim. Megjithate, dokumenti 120 faqesh identifikon sfida te mbetura serioze te cilat kerkojne adresim te vazhdueshëm dhe konsistent nga institucionet kosovare. Papunesia e larte sidomos tek te rinjte, emigrimi masiv i kapitalit njerezor dhe pabarazia rajonale mbeten sfida prioritare qe kerkojne politika strukturore afatgjate dhe te koordinuara me partnerët nderkombetare. Kryeministri kosovar priti raportin me qendrim konstruktiv dhe theksoi angazhimin e qeverise per zbatimin e te gjithe pikave te rekomanduara per periudhën qe vjen. Ai veçoi liberalizimin e vizave si nje nga arritjet me konkrete qe ka ndikuar drejtperdrejt ne cilesine e jetes se qytetareve kosovar. Opozita parlamentare kerkoi llogaridhenie per vonesën e reformave dhe theksoi se ritmi i progresit eshte ngadalesuar nen qeverine aktuale ne disa sektore specifike te identifikuara nga Komisioni. Organizatat e shoqerise civile vleresuan raportin si realist dhe theksuan nevojën per monitorim te pavarur te zbatimit te reformave te rekomanduara nga qeveria. Ato kerkuan transparencë me te madhe ne institucionet publike dhe permiresim te mekanizmave te llogaridheniës per zyrtaret ne te gjitha nivelet e administrates publike. Parlamenti Europian do te diskutoje gjeresisht raportin ne sesionin plenar te muajit te ardhshem ku priten debate te rendesishme per perspektiven e anetaresimit. Statusi i kandidatit per anetaresim mbetet prioriteti strategjik i politikes se jashtem kosovare dhe nje objektive me mbeshtetje te gjere publike ndermjet partive politike kryesore. Bashkimi Europian ka konfirmuar vazhdimesine e fondeve te asistences per zbatimin e reformave te rekomanduara. Instrumenti IPA dhe mekanizmat e tjere te financimit europian do te mbeshtesin financiarisht procesin e transformimit institucional te nevojshem per integrimin e plote ne komunitetin europian."

# Article 2 - FMN - currently has wrong (diaspora) content, needs FMN content >=330 words
# Unique anchor: slug "ekonomia-kosoves-rritje" ... body: `Banka Qendrore e Kosoves ka raportuar nje rritje te remitencave`
$b2 = "Parashikimet ekonomike te Fondit Monetar Nderkombetar per Kosoven jane rishikuar ne drejtim pozitiv, duke projektuar nje rritje te GDP-se prej 4.8 perqind per vitin aktual. Ky nivel tejkalon mesataren rajonale dhe pasqyron performancën pozitive te sektoreve kryesore si ndertimi, tregtia me shumice dhe sherbimet financiare te vendit. Analiza e FMN-se thekson se stabiliteti fiskal i Kosoves ka qene i qendrueshëm gjate viteve te fundit dhe ka rritur besueshmërinë e vendit si partner ekonomik rajonal. Te ardhurat tatimore dhe doganore jane rritur ne menyre te vazhdueshme duke kontribuar ne stabilitetin e buxhetit dhe duke lejuar rritje te investimeve publike ne infrastrukture. Megjithate, ekspertet nderkombetare theksojne sfida strukturore qe kerkojne adresim prioritar per nje rritje ekonomike me te qendrueshme dhe gjitheperfshirese. Investimet e huaja direkte mbeten nen potencialin e vendit dhe kufizojne transferimin e teknologjise dhe krijimin e vendeve te punes te kualifikuara ne sektore strategjike te ekonomise. Sektori bankar vlerësohet si i qendrueshëm nga ana e FMN-se me tregues te pranueshme te kapitalizimit dhe likuiditetit. Normat e kredive jo-performuese ndodhen ne nivel te kontrollueshem ndersa huazimi per sektorin privat ka shenuar rritje te konsiderueshme ne vitet e fundit. Inflacioni ka zbritur gradualisht nga kulmet e arritura gjate krizës energjetike globale dhe tashme ndodhet brenda kufijve te pranueshëm per nje ekonomi te hapur europiane. Ministri i Financave priti me optimizem vleresimin e FMN-se dhe prezantoi planin ambicioz per investime publike ne infrastrukturë rrugore, energjetike dhe dixhitale per periudhën e ardhshme. Ekspertet e shoqerise civile dhe organizatat nderkombetare kerkojne qe rimëkembja ekonomike te shoqerohet me politika sociale efektive qe adresojne pabarazine ne te ardhura midis popullates urbane dhe asaj rurale. Komuniteti i biznesit kosovar ka vleresuar me optimizem parashikimet e FMN-se dhe ka kerkuar vazhdimin e reformave per te permiresuar ambientin rregullator dhe per te reduktuar barrën administrative mbi kompanitë."

# Use slug-anchored patterns (Singleline mode so [^`] spans multiple lines if needed)
$opts = [System.Text.RegularExpressions.RegexOptions]::Singleline

# Fix Article 1: match slug then its body (which still has original "Komisioni Evropian" text)
$content = [regex]::Replace($content,
    '(slug: "kosova-be-raport-2025"[^`]*)body: `[^`]*`',
    "`$1body: ``$b1``",
    $opts)

# Fix Article 2: match slug then its body (which now wrongly has "Banka Qendrore" diaspora content)
$content = [regex]::Replace($content,
    '(slug: "ekonomia-kosoves-rritje"[^`]*)body: `[^`]*`',
    "`$1body: ``$b2``",
    $opts)

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Output "Done."

# Verify
$slugs = @("kosova-be-raport-2025", "ekonomia-kosoves-rritje", "nato-kosove-stervitje", "diaspora-investime-kosove", "kosova-sport-kampionat", "teknologji-startup-pristina")
foreach ($slug in $slugs) {
    $m = [regex]::Match($content, "slug: `"$slug`"[^``]*body: ``([^``]*)``", $opts)
    if ($m.Success) {
        $words = ($m.Groups[1].Value.Trim() -split '\s+' | Where-Object { $_ }).Count
        $mins = [Math]::Max(1, [Math]::Round($words / 220))
        Write-Output "$slug`: $words words -> $mins min"
    } else {
        Write-Output "$slug`: NOT MATCHED"
    }
}
