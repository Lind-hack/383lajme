"""A oneshot's old success exit code must never hide its currently running state."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-automation-status.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
assert collector.job_status({'ActiveState':'activating','Result':'success'}) == 'running'
assert collector.job_status({'ActiveState':'failed','Result':'timeout'}) == 'failed'
assert collector.job_status({'ActiveState':'inactive','Result':'success','ExecMainExitTimestamp':'Sat 2026-09-12 19:35:44 UTC'}) == 'success'
assert collector.timestamp('n/a') is None
assert collector.timestamp('Sat 2026-09-12 19:35:44 UTC') == '2026-09-12T19:35:44+00:00'
print('Automation status checks passed')
