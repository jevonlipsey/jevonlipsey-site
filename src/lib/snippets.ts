// clamp a long abstract to the first `wordCap` words so the list cards stay
// compact and invite the [read note] jump; the full text lives on the paper page
export function intro(text: string, wordCap = 90): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCap) return text;
  return words.slice(0, wordCap).join(' ') + '...';
}