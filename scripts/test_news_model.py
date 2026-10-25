import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import hashlib
from pathlib import Path
from unittest.mock import patch

import news_model as model


class NewsModelTests(unittest.TestCase):
    def test_native_image_response_requires_wire_proof_and_complete_inline_brief(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);image=root/'contact.jpg';image.write_bytes(b'fixture')
            brief=root/'brief.md';brief.write_text('Complete story and photo metadata.',encoding='utf-8')
            proof={'provider':'openai-codex','model':'gpt-6-luna','effort':'max','wire_requests':1,
                   'image_sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
            result=subprocess.CompletedProcess([],0,'383_JSON_BEGIN [] 383_JSON_END',
                '383_NATIVE_PIXELS_VERIFIED '+json.dumps(proof))
            with patch.object(model,'run_process',return_value=result) as call:
                self.assertEqual(model.ask_rows('Judge the attached pixels.',brief,[],10,image_path=image),[])
                self.assertIn('news_native_pixels.py',call.call_args.args[0][1])
                self.assertIn(brief.read_text(),image.with_suffix('.prompt.txt').read_text())
            for stderr in ('', '383_NATIVE_PIXELS_VERIFIED '+json.dumps({**proof,'effort':'low'}),
                           '383_NATIVE_PIXELS_VERIFIED '+json.dumps({**proof,'image_sha256':'changed'})):
                with patch.object(model,'run_process',return_value=subprocess.CompletedProcess([],0,result.stdout,stderr)):
                    with self.assertRaises(ValueError):model.ask_rows('Judge pixels.',brief,[],10,image_path=image)

    def test_only_luna_oauth_and_retained_max_configuration_are_allowed(self):
        args = model.model_args(["-t", "file"])
        self.assertEqual(args[args.index("--model") + 1], "gpt-6-luna")
        self.assertEqual(args[args.index("--provider") + 1], "openai-codex")
        for invalid in (["--provider", "openai"], ["--model", "gpt-6-sol"],
                        ["--provider=openai"], ["--ignore-user-config"],
                        ["--model", "gpt-6-luna", "--model", "other"]):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                model.model_args(invalid)

    def test_expired_deadline_prevents_any_process_from_starting(self):
        with patch.object(model.subprocess, "Popen") as spawn:
            with self.assertRaises(subprocess.TimeoutExpired):
                model.run_process(["not-a-real-command"], 30, deadline=time.monotonic() - 1)
            spawn.assert_not_called()

    def test_worker_absolute_deadline_shortens_side_job_deadline(self):
        with patch.dict(os.environ, {"L383_MODEL_DEADLINE_EPOCH": "102"}), \
                patch.object(model.time, "time", return_value=100), \
                patch.object(model.time, "monotonic", return_value=50):
            self.assertEqual(model.stage_deadline(420), 52)

    def test_complete_json_and_empty_decisions_have_no_api_fallback(self):
        result = subprocess.CompletedProcess([], 0, '383_JSON_BEGIN [] 383_JSON_END', '')
        with patch.object(model, "run_process", return_value=result) as invoke:
            self.assertEqual(model.ask_rows("Read evidence.", Path("brief.md"), ["-t", "file"], 10), [])
            command = invoke.call_args.args[0]
            self.assertIn("openai-codex", command)
            self.assertIn("gpt-6-luna", command)
        result = subprocess.CompletedProcess([], 1, '', '')
        with patch.object(model, "run_process", return_value=result) as invoke:
            with self.assertRaises(ValueError):
                model.ask_rows("Read evidence.", Path("brief.md"), [], 10)
            self.assertEqual(invoke.call_count, 1)

    @unittest.skipUnless(os.name == "posix", "Process-group behavior is verified on the Linux worker")
    def test_timeout_stops_model_descendants_before_they_can_write(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "still-running"
            child = f"import time,pathlib;time.sleep(1);pathlib.Path({str(target)!r}).write_text('leaked')"
            parent = "import subprocess,sys,time;subprocess.Popen([sys.executable,'-c'," + repr(child) + "]);time.sleep(30)"
            with self.assertRaises(subprocess.TimeoutExpired):
                model.run_process([sys.executable, "-c", parent], .1)
            time.sleep(1.2)
            self.assertFalse(target.exists())
            self.assertEqual(model._ACTIVE, set())

    @unittest.skipUnless(os.name == "posix", "SIGTERM cleanup is verified on the Linux worker")
    def test_main_thread_termination_stops_model_started_by_a_review_thread(self):
        import signal
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'leaked-review'
            child = f"import time,pathlib;time.sleep(2);pathlib.Path({str(target)!r}).write_text('leaked')"
            script = (
                "import sys,time,concurrent.futures;import news_model as m;"
                "m.install_termination_cleanup();"
                "pool=concurrent.futures.ThreadPoolExecutor(max_workers=1);"
                f"task=pool.submit(m.run_process,[sys.executable,'-c',{child!r}],30);"
                "\nwhile not m._ACTIVE: time.sleep(.01)\n"
                "print('ready',flush=True);task.result()"
            )
            env = {**os.environ, 'PYTHONPATH': str(Path(__file__).parent)}
            process = subprocess.Popen([sys.executable, '-c', script], stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True, env=env)
            try:
                self.assertEqual(process.stdout.readline().strip(), 'ready')
                process.send_signal(signal.SIGTERM)
                process.communicate(timeout=5)
                time.sleep(2.1)
                self.assertFalse(target.exists())
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate()


if __name__ == "__main__":
    unittest.main()
