import json
import tempfile
import unittest
from pathlib import Path

from news_writer_recovery import prepare


class RecoveryTests(unittest.TestCase):
    def test_recover_third_slot_without_repeating_failed_scope_or_consuming_successful_spares(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            def save(name,data):
                path=root/name;path.write_text(json.dumps(data),encoding='utf-8');return path
            discovery=save('discovery.json',{'publication_plan':{'Showbiz':3}})
            batch=save('batch.json',[{'url':'https://example/approved-1','category':'Showbiz'},
                                    {'url':'https://example/approved-2','category':'Showbiz'}])
            save('1-brief.sources.json',[{'url':'https://example/refused-exclusive'},{'url':'https://example/refused-photo'}])
            save('1.json',[])
            save('2-brief.sources.json',[{'url':'https://example/approved-1'},{'url':'https://example/unused-spare'}])
            save('2.json',[{'url':'https://example/approved-1'}])
            attempted=save('attempted.json',['https://example/earlier'])
            self.assertEqual(prepare(discovery,batch,root,attempted),[('Showbiz',1)])
            used=json.loads(attempted.read_text(encoding='utf-8'))
            self.assertIn('https://example/refused-exclusive',used)
            self.assertIn('https://example/refused-photo',used)
            self.assertIn('https://example/earlier',used)
            self.assertNotIn('https://example/unused-spare',used)


if __name__=='__main__':unittest.main()
