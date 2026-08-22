from verify_selected import verify
urls = [
"https://www.football365.com/news/transfer-window-summer-2026-rumours-ranked",
"https://www.goal.com/en/lists/summer-transfer-window-2026-biggest-deals-graded/bltba6505bafe3b2faa",
"https://metro.co.uk/2026/07/25/man-utd-board-raise-doubt-51m-manu-kone-transfer-29218675/",
"https://www.nytimes.com/athletic/7468638/2026/07/25/liverpool-transfer-news-squad-gaps/",
]
for u in urls:
 print('\t'.join(map(str,verify(u))))
