"""Confirm this installed Hermes resolves the explicit data-only toolset to zero tools."""
import sys

sys.path.insert(0, '/opt/hermes')
from model_tools import get_tool_definitions

tools = get_tool_definitions(enabled_toolsets=['none'], quiet_mode=True)
if tools:
    raise SystemExit('383 DATA-ONLY MODEL CONTRACT failed: the installed runtime enables tools for this selection')
print('383 DATA-ONLY MODEL CONTRACT: resolved_tools=0; all required references must be supplied inline')
