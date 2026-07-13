import importlib.util, json, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
def load(path,name):
 s=importlib.util.spec_from_file_location(name,ROOT/path); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
def article(i):
 p=" ".join(["Lajmi"]*100); body="\n\n".join([p]*5)
 return {"id":f"a{i}","slug":f"artikulli-testues-{i:02d}","url":f"https://source{i}.example/story","dispatch":str(i),"title":f"Titulli i artikullit {i}","excerpt":"Permbledhje testuese.","body":body,"source":f"Source {i}","source_flag":"","source_bias":"neutral","tone":"neutral","category":"Politikë","published_at":"2026-07-13T12:00:00+02:00","reading_time":3,"featured":False,"engagement_score":7.0,"score_reason":"test","score_breakdown":{"relevance":7,"urgency":7,"public_impact":7,"local_depth":7,"controversy_interest":7,"credibility":7,"corroboration":7,"editorial_safety":7},"score_formula":"test","image_url":f"https://images{i}.example/a.jpg","image_width":1400,"image_height":800,"created_at":"2026-07-13T12:00:00+02:00"}
def test_verified_non_social_batch_is_a_valid_fallback():
 support=load(Path('scripts/codex_automation_support.py'),'support'); mix=load(Path('scripts/validate_source_mix.py'),'mix'); old=support._fetch_image_dimensions; support._fetch_image_dimensions=lambda _: (1400,800)
 try:
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'2026-07-13T12.json'; p.write_text(json.dumps([article(i) for i in range(1,14)]))
   assert len(support.validate_batch(p))==13
   assert mix.validate(p)==0
 finally: support._fetch_image_dimensions=old
if __name__=='__main__': test_verified_non_social_batch_is_a_valid_fallback(); print('social fallback regression check passed')
