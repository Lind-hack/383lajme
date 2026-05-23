import os
import re
import json
import requests

GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

SCORE_PROMPT = """Rate this news article for a Kosovo news platform.
Consider:
1. Kosovo relevance (is Kosovo the main subject, not just a passing mention?)
2. Engagement potential (will Kosovo readers find this important/interesting?)
3. Breaking/urgency signals (elections, arrests, disasters, major policy, conflict)

Score 1-10. Return ONLY JSON: {{"score": N, "breaking": true_or_false}}
Where breaking=true if the article involves urgent breaking news.

Title: {title}
Summary: {summary}"""


def _strip_thinking(text: str) -> str:
    # Gemma 4 wraps its reasoning in <thought>...</thought> — strip it before parsing
    return re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL).strip()


def score_article(title: str, summary: str) -> dict:
    try:
        resp = requests.post(
            GOOGLE_AI_URL,
            headers={
                "Authorization": f"Bearer {os.environ['GOOGLE_AI_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gemma-4-31b-it",
                "messages": [
                    {
                        "role": "user",
                        "content": SCORE_PROMPT.format(title=title, summary=summary[:500]),
                    }
                ],
                "max_tokens": 1024,
            },
            timeout=60,
        )
        resp.raise_for_status()
        text = _strip_thinking(resp.json()["choices"][0]["message"]["content"])
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        print(f"  Scorer error: {e}")
        return {"score": 0, "breaking": False}
