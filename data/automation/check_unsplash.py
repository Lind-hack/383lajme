import sys
sys.path.insert(0,'scripts')
from codex_automation_support import _fetch_image_dimensions
urls=['https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&h=900&q=85','https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1600&h=900&q=85','https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&h=900&q=85','https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&h=900&q=85']
for u in urls:
 try:print(_fetch_image_dimensions(u),u)
 except Exception as e:print(type(e).__name__,e,u)
