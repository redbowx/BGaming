export function normalizeTitle(title: string) {
  return title
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(normalizeTitleToken)
    .join(" ");
}

function normalizeTitleToken(token: string) {
  if (!/^\d+$/.test(token)) {
    return token;
  }

  const normalizedNumber = token.replace(/^0+(\d)/, "$1");
  return normalizedNumber === "" ? "0" : normalizedNumber;
}
