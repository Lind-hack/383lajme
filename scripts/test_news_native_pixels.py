import asyncio
import base64
import copy
import hashlib
import unittest

from news_native_pixels import check_wire, refuse, refuse_async, PixelReviewAbort


class NativePixelGuardTests(unittest.TestCase):
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
