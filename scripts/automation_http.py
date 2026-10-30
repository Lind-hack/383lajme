"""Bounded retries for reads and explicitly idempotent automation writes."""
import time
from httpx import TransportError


def retry_http(call, *args, attempts=3, sleep=None, **kwargs):
    sleep = sleep or time.sleep
    for attempt in range(attempts):
        try:
            response = call(*args, **kwargs)
        except TransportError:
            if attempt == attempts - 1:
                raise
        else:
            if getattr(response, 'status_code', 200) not in (408, 429, 500, 502, 503, 504) or attempt == attempts - 1:
                return response
            # Release the connection before retrying. Never log URLs, auth or bodies.
            response.close()
        sleep(2 ** attempt)
    raise ValueError('At least one HTTP attempt is required')
