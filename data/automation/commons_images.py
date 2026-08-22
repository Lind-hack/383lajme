import urllib.request,json
terms=['Gazivode lake Kosovo','protest Novi Sad Serbia','electricity grid Kosovo power lines','Wizz Air aircraft']
for term in terms:
 url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+urllib.parse.quote(term)+'&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size&format=json'
 try:
  data=json.load(urllib.request.urlopen(url,timeout=30))
  print('\nTERM',term)
  for page in data.get('query',{}).get('pages',{}).values():
   ii=page.get('imageinfo',[{}])[0]
   print(page.get('title'),ii.get('width'),ii.get('height'),ii.get('url'))
 except Exception as e: print('ERR',e)
