export function nextPosition(items: { position: number }[]) {
  if (!items.length) return 0;
  const position = Math.max(...items.map((item) => item.position)) + 1;
  if (position > 2147483647) throw new Error("Die Positionswerte sind ausgeschöpft. Bitte ordne die Liste zuerst neu.");
  return position;
}
