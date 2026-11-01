"""Bounded contact sheets and byte-bound records for native photo review."""
import concurrent.futures
import hashlib
import threading
import time
from datetime import datetime, timezone
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

POLICY = '383-native-photo-v1'
MAX_VISIBLE = 8
TILE_WIDTH, TILE_HEIGHT = 200, 150
_DOWNLOADS = threading.BoundedSemaphore(6)


def option_url(option):
    if option['tier'] == 'video':
        return f"https://i.ytimg.com/vi/{option['video']['video_id']}/maxresdefault.jpg"
    return option['photo']['image_url']


def balanced_options(options):
    tiers = {}
    for number, option in enumerate(options, 1):
        tiers.setdefault(option['tier'], []).append(number)
    selected = []
    for offset in range(max(map(len, tiers.values()), default=0)):
        for numbers in tiers.values():
            if offset < len(numbers) and len(selected) < MAX_VISIBLE:
                selected.append(numbers[offset])
    return sorted(selected)


@lru_cache(maxsize=128)
def _thumbnail(url, publisher_article=False):
    from news_image_policy import photo_payload
    payload = photo_payload(url)
    with Image.open(BytesIO(payload)) as image:
        minimum=(600,350) if publisher_article else (1200,630)
        if image.width < minimum[0] or image.height < minimum[1] or image.width * image.height > 50_000_000:
            raise ValueError('photo dimensions outside policy')
        thumb = ImageOps.contain(ImageOps.exif_transpose(image).convert('RGB'), (TILE_WIDTH - 8, TILE_HEIGHT - 26))
        buffer = BytesIO()
        thumb.save(buffer, format='JPEG', quality=85)
    return hashlib.sha256(payload).hexdigest(), buffer.getvalue()


def prepare(by_id, folder: Path, index: int, deadline: float):
    jobs = [(key, number, story['options'][number - 1]) for key, story in by_id.items()
            for number in balanced_options(story['options'])]

    def load(job):
        if time.monotonic() >= deadline or not _DOWNLOADS.acquire(timeout=max(0, min(5, deadline-time.monotonic()))):
            return None
        try:
            if time.monotonic() >= deadline:
                return None
            key, number, option = job
            digest, thumbnail = _thumbnail(option_url(option),option['tier']=='article')
            option['_visual_source_sha256'] = digest
            return key, number, thumbnail
        except Exception:
            return None  # Unreadable pixels never get a positive visual verdict.
        finally:
            _DOWNLOADS.release()

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        loaded = [item for item in pool.map(load, jobs) if item is not None]
    visible = {key: [] for key in by_id}
    if not loaded:
        return None, visible
    sheet = Image.new('RGB', (MAX_VISIBLE * TILE_WIDTH,
                             ((len(loaded) + MAX_VISIBLE - 1) // MAX_VISIBLE) * TILE_HEIGHT), 'white')
    draw = ImageDraw.Draw(sheet)
    for position, (key, number, thumbnail) in enumerate(loaded):
        row, column = divmod(position, MAX_VISIBLE)
        x, y = column * TILE_WIDTH, row * TILE_HEIGHT
        draw.text((x + 4, y + 3), f'{key} option {number}', fill='black')
        with Image.open(BytesIO(thumbnail)) as image:
            sheet.paste(image, (x + 4, y + 22))
        visible[key].append(number)
    buffer = BytesIO()
    sheet.save(buffer, format='JPEG', quality=90)
    payload = buffer.getvalue()
    path = folder / f'news-photo-contact-{index}-{hashlib.sha256(payload).hexdigest()[:16]}.jpg'
    path.write_bytes(payload)
    print(f'383 PHOTO PIXELS chunk {index}: offered={len(jobs)} visible={len(loaded)}')
    return path, visible


def attestation(option, sheet: Path):
    return {'policy': POLICY, 'provider': 'openai-codex', 'model': 'gpt-6-luna', 'effort': 'max',
            'image_sha256': option['_visual_source_sha256'],
            'contact_sheet_sha256': hashlib.sha256(sheet.read_bytes()).hexdigest(),
            'reviewed_at': datetime.now(timezone.utc).isoformat()}


def valid_record(rights):
    if not isinstance(rights,dict):
        return False
    proof = rights.get('visual_review') or {}
    if not isinstance(proof,dict):
        return False
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(proof['reviewed_at'])).total_seconds()
    except (KeyError, TypeError, ValueError):
        return False
    def sha(value):
        return isinstance(value,str) and len(value)==64 and all(char in '0123456789abcdef' for char in value)
    return (proof.get('policy') == POLICY and proof.get('provider') == 'openai-codex'
            and proof.get('model') == 'gpt-6-luna' and proof.get('effort') == 'max'
            and sha(proof.get('contact_sheet_sha256')) and sha(proof.get('image_sha256'))
            and proof.get('image_sha256') == rights.get('sha256') and 0 <= age <= 3600)
