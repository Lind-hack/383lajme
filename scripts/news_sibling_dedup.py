"""Use the existing story detector for repeats within a pending batch."""


def story_pairs(articles, same_story, overlap):
    return [(index, previous, overlap(article, articles[previous]))
            for index, article in enumerate(articles) for previous in range(index)
            if same_story(article, articles[previous])]


def distinct(articles, *, same_story, overlap, clear_repeat, judge):
    pairs = story_pairs(articles, same_story, overlap)
    uncertain = [(index, previous) for index, previous, score in pairs if score < clear_repeat]
    decisions = iter(judge([(articles[index], articles[previous]) for index, previous in uncertain])) if uncertain else iter(())
    fresh = {pair: next(decisions, False) is True for pair in uncertain}
    repeats = {(index, previous) for index, previous, score in pairs
               if score >= clear_repeat or not fresh.get((index, previous), False)}
    kept, rejected = [], []
    for index in range(len(articles)):
        previous = next((old for old in kept if (index, old) in repeats), None)
        if previous is None:
            kept.append(index)
        else:
            rejected.append((index, previous))
    return [articles[index] for index in kept], rejected
