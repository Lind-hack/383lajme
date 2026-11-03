/** React renders these as text or HTTPS anchors, never as scraped HTML. */
export function articleLinks(text) {
  return String(text).split(/(https:\/\/[^\s<>]+)/g).filter(Boolean).map((part) => {
    if (!part.startsWith('https://')) return { text: part };
    const url = part.replace(/[.,;!?)]+$/, '');
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
        return { text: part, url };
      }
    } catch { /* Keep malformed URLs as ordinary text. */ }
    return { text: part };
  });
}
