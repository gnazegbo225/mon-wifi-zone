// Petit lecteur CSV, sans dépendance.
// - Ignore le BOM UTF-8 en début de fichier.
// - Séparateur « , » ou « ; » : détecté sur la première ligne non vide (l'en-tête).
// - Gère les champs entre guillemets ("a;b", "il dit ""bonjour""") et les fins de ligne \n ou \r\n.
// Renvoie { delimiter, records } où chaque record vaut { line, fields } :
// line est le numéro de ligne dans le fichier (1 = première ligne), utile pour le rapport.

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') || '';
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ',') commas += 1;
    else if (!inQuotes && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsv(input) {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);

  const records = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    fields.push(field);
    records.push({ line: recordLine, fields });
    fields = [];
    field = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      // \r\n : on laisse le \n terminer la ligne.
    } else if (char === '\n' || char === '\r') {
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      field += char;
    }
  }

  // Dernière ligne sans retour à la ligne final.
  if (field !== '' || fields.length > 0) endRecord();

  return { delimiter, records };
}

// Une ligne vide (ou seulement des séparateurs et des espaces) ne compte pas.
function isBlankRecord(record) {
  return record.fields.every((f) => f.trim() === '');
}

module.exports = { parseCsv, isBlankRecord };
