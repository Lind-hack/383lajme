import time
import urllib.request
url = "https://383ks.com/article/gazivoda-shqetesimi-per-prishjet-dhe-thirrja-per-procedure?verify=" + str(int(time.time()))
request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "383-direct-route-verifier/1.0"})
with urllib.request.urlopen(request, timeout=30) as response:
    page = response.read().decode("utf-8", errors="replace")
    title = "Prishjet pranë Gazivodës sjellin thirrje për proces të rregullt"
    if title not in page:
        raise RuntimeError("fresh canonical page missing title marker")
    print(f"CANONICAL ROUTE VERIFY ok: {response.url} status {response.status}; fresh title marker visible")
