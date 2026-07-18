const escapeHTML = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] || character;
  });

export function printTable(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    throw new Error(
      "Jendela cetak diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.",
    );
  }

  const tableHead = headers
    .map((header) => `<th>${escapeHTML(header)}</th>`)
    .join("");
  const tableBody = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  popup.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHTML(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f3f4f6; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}
