// The keys above are written in a convenient order; shuffle each question's
// options the same way every time so the right answer is spread over A to E.
export function shuffleOptions(options, answer, seed) {
  let state = seed * 2654435761 % 4294967296;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const order = options.map((_, i) => i);

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return { options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

