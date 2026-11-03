"""Publication identity is per desk; on-disk hourly filenames stay compatible."""
import os
from pathlib import Path

DESKS = {
    'kosove': 'Kosovë', 'shqiperi': 'Shqipëri', 'sport': 'Sport',
    'teknologji': 'Teknologji', 'ekonomi': 'Ekonomi', 'bote': 'Botë',
    'showbiz': 'Showbiz',
}


def batch_key(path: Path) -> str:
    desk = os.environ.get('L383_RUN_DESK', '')
    if desk and desk not in DESKS:
        raise ValueError('Unknown isolated news desk')
    return f'{path.stem}-{desk}' if desk else path.stem
