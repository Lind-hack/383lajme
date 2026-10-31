import asyncio
import base64
import copy
import hashlib
import unittest
import types
from unittest.mock import patch

from news_native_pixels import check_wire, refuse, refuse_async, PixelReviewAbort, native_input_mode, enable_luna_max_effort


class NativePixelGuardTests(unittest.TestCase):
    def test_luna_effort_metadata_is_process_local_and_other_models_are_unchanged(self):
        agent=types.ModuleType('agent');transports=types.ModuleType('agent.transports')
        codex=types.ModuleType('agent.transports.codex')
        agent.transports=transports;transports.codex=codex
        modules={'agent':agent,'agent.transports':transports,'agent.transports.codex':codex}
        with patch.dict('sys.modules',modules):
            enable_luna_max_effort()  # Legacy transports need no table patch.
            codex.codex_supported_efforts=lambda model:('low','medium','high','xhigh')
            enable_luna_max_effort()
            self.assertIn('max',codex.codex_supported_efforts('gpt-6-luna'))
            self.assertNotIn('max',codex.codex_supported_efforts('another-model'))

    def test_new_and_existing_routing_signatures_require_the_same_native_model(self):
        self.assertEqual(native_input_mode('openai-codex','gpt-6-luna',{}),'native')
        self.assertEqual(native_input_mode('openai-codex','gpt-6-luna',{},requested_provider='openai-codex'),'native')
        for provider,model,requested in [('other','gpt-6-luna',None),('openai-codex','other',None),
                                          ('openai-codex','gpt-6-luna','other')]:
            with self.assertRaises(PixelReviewAbort):
                native_input_mode(provider,model,{},requested_provider=requested)

    def test_only_exact_pixels_luna_max_and_no_tools_can_cross_the_wire(self):
        data=b'pixel fixture';digest=hashlib.sha256(data).hexdigest()
        payload={'model':'gpt-6-luna','reasoning':{'effort':'max'},'input':[{'role':'user','content':[
            {'type':'input_image','image_url':'data:image/jpeg;base64,'+base64.b64encode(data).decode()}]}]}
        check_wire(payload,digest)
        for field,value in [('model','gpt-6-sol'),('reasoning',{'effort':'low'}),('input',[]),('tools',[{'type':'function'}])]:
            altered=copy.deepcopy(payload);altered[field]=value
            with self.subTest(field=field),self.assertRaises(PixelReviewAbort):check_wire(altered,digest)
        with self.assertRaises(PixelReviewAbort):check_wire(payload,'changed')
        altered=copy.deepcopy(payload);altered['input'][0]['content']*=2
        with self.assertRaises(PixelReviewAbort):check_wire(altered,digest)

    def test_auxiliary_and_strip_abort_escape_normal_exception_fallback_handlers(self):
        for function in (refuse,lambda:asyncio.run(refuse_async())):
            with self.assertRaises(PixelReviewAbort) as raised:function()
            self.assertNotIsInstance(raised.exception,Exception)
            self.assertNotEqual(raised.exception.code,0)


if __name__=='__main__':unittest.main()
