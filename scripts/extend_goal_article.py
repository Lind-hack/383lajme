import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
articles[-1]['body'] += (
    ' Për më tepër, një afat transferimesh nuk vlerësohet vetëm nga shuma e lëvizjeve. '
    'Është e rëndësishme të shihet nëse klubet kanë zgjidhur nevoja konkrete, nëse kanë '
    'ruajtur ekuilibër financiar dhe nëse u kanë dhënë trajnerëve kohë për të punuar me '
    'skuadrën. Vetëm kombinimi i këtyre elementeve tregon nëse një verë e zhurmshme do '
    'të kthehet në avantazh sportiv kur të fillojnë ndeshjet zyrtare. Deri atëherë, '
    'tifozët mund të mbështeten te marrëveshjet e njoftuara dhe jo te negociatat e paqarta.'
)
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('extended final article')
