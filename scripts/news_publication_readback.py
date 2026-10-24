"""Compare persisted news against the exact reviewed records, by article ID."""
from datetime import datetime, timezone


def _timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def verify_rows(expected: list[dict], persisted: list[dict], batch_key: str) -> None:
    wanted = {str(row['id']): row for row in expected}
    actual = {str(row.get('id', '')): row for row in persisted}
    if len(wanted) != len(expected) or len(actual) != len(persisted) or set(actual) != set(wanted):
        raise RuntimeError(f'SUPABASE readback identity/count mismatch for batch {batch_key!r}')
    for key, row in wanted.items():
        saved = actual[key]
        for field, value in row.items():
            matches = field in saved and saved[field] == value
            if field in {'published_at', 'created_at'}:
                matches = _timestamp(value) is not None and _timestamp(value) == _timestamp(saved.get(field))
            elif field == 'raw_article':
                # A legacy retry's local file may lack extra database review
                # metadata. Every field actually supplied must still match.
                matches = isinstance(saved.get(field), dict) and all(
                    name in saved[field] and saved[field][name] == item for name, item in value.items())
            if not matches:
                raise RuntimeError(f'SUPABASE readback mismatch for batch {batch_key!r}, article {key!r}, field {field!r}')
