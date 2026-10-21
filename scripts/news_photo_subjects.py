"""Conservative, network-free grounding for photo search subjects."""
import re

from editorial_rules_v2 import fold


GENERIC_SUBJECTS = {
    "policia", "police",
    "qeveria", "government", "news", "video", "photo", "park",
    "shopping basket", "internet", "politics", "economy", "technology",
}
NON_PHOTO = re.compile(
    r"\b(?:flag|logo|emblem|signature|nenshkrim|flamur|map|diagram|chart|"
    r"screenshot|wordmark|drawing|painting|illustration|coat of arms)\b", re.I)


def publisher_names(publishers, current_source=""):
    """Exclude media outlets; official institutions can themselves be news."""
    official = {fold(p["source"]) for p in publishers if p.get("role") == "official_evidence"}
    names = {p["source"] for p in publishers if p.get("role") != "official_evidence"}
    names.update(domain for p in publishers if p.get("role") != "official_evidence" for domain in p["domains"])
    if current_source and fold(current_source) not in official:
        names.add(current_source)
    return names


def words(value):
    return re.findall(r"[^\W_]+", fold(value), re.UNICODE)


def same_name_word(canonical, observed):
    """Allow Albanian case endings, not arbitrary shared prefixes."""
    if canonical == observed:
        return True
    if len(canonical) < 4:
        return False
    stems = {canonical}
    if canonical.endswith(("a", "i", "e")):
        stems.add(canonical[:-1])
    return any(observed == stem + ending for stem in stems
               for ending in ("a", "e", "i", "u", "es", "en", "it", "in", "ut", "un", "s"))


def grounded(subject, evidence):
    wanted, actual = words(subject), words(evidence)
    return bool(wanted) and any(
        all(same_name_word(left, right) for left, right in zip(wanted, actual[index:]))
        for index in range(len(actual) - len(wanted) + 1))


def subject_allowed(subject, evidence, outlets):
    name = " ".join(words(subject))
    forbidden = {" ".join(words(outlet)) for outlet in outlets if outlet}
    return (bool(name) and name not in GENERIC_SUBJECTS and name not in forbidden
            and not NON_PHOTO.search(name) and grounded(subject, evidence))


def wiki_identity_allowed(page, searched_name, evidence, category, outlets, *, require_photo=True):
    """A Wikipedia lead image must not resolve a namesake or a non-photo.

    Descriptions come in the same Wikipedia response, so these checks add no
    Wikidata requests. Ambiguous names remain unresolved for the model planner.
    """
    subject = re.sub(r"\s*\(.*?\)", "", str(page.get("title", ""))).strip()
    image = str(page.get("pageimage", "")).replace("_", " ")
    description = fold(" ".join(page.get("terms", {}).get("description", [])))
    team_alias = re.sub(r"^(?:FC|CF|FK|KF)\s+", "", subject)
    named_team = (category == "Sport" and team_alias != subject
                  and re.search(r"\b(?:football|basketball|sports)\s+(?:club|team)\b", description)
                  and subject_allowed(team_alias, evidence, outlets))
    if require_photo and (not image or image.lower().endswith(".svg") or NON_PHOTO.search(image)):
        return False
    if not (subject_allowed(subject, evidence, outlets) or named_team):
        return False
    if not (grounded(searched_name, subject) or grounded(subject, searched_name)):
        return False
    if re.search(r"\b(?:deity|mytholog\w*|anatom\w*|geolog\w*|common name|surname|disambiguation)\b", description):
        return False
    if len(words(subject)) == 1:
        # A bare word/acronym needs a concrete entity description from the
        # same response. Full names in the story remain eligible without one.
        if not re.search(r"\b(?:company|corporation|organisation|organization|institution|agency|bank|"
                         r"club|team|city|town|municipality|stadium|airport|politician|singer|actor)\b", description):
            return False
        if subject.isupper():
            context = set(words(evidence)) - set(words(subject))
            described = {word for word in words(description) if len(word) > 4}
            if not context & described:
                return False
    if category == "Sport" and re.search(r"\b(?:city|town|municipality)\b", description):
        # 'Barcelona' in a match report does not establish a cityscape as a
        # visual of FC Barcelona. An explicitly named stadium remains eligible.
        return False
    return True
