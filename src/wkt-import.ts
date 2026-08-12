function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

const stripOuterParens = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed.slice(1, -1).trim() : trimmed;
};

function parseCoordinateSequence(value: string): number[][] {
  return splitTopLevel(value).map(token => {
    const numbers = token.trim().split(/\s+/).map(Number);
    if (numbers.length < 2 || !Number.isFinite(numbers[0]) || !Number.isFinite(numbers[1])) throw new Error(`Coordenada WKT no válida: ${token}`);
    return [numbers[0], numbers[1]];
  });
}

function parsePolygonBody(body: string): number[][][] {
  return splitTopLevel(stripOuterParens(body)).map(ring => parseCoordinateSequence(stripOuterParens(ring)));
}

export function parseWktGeometry(raw: string): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  const match = /^\s*(POLYGON|MULTIPOLYGON)\s*(?:Z|M|ZM)?\s*(\(.+\))\s*$/is.exec(raw.trim());
  if (!match) throw new Error('La API no devuelve un WKT POLYGON/MULTIPOLYGON reconocible.');
  const type = match[1].toUpperCase();
  const body = match[2];
  if (type === 'POLYGON') return { type: 'Polygon', coordinates: parsePolygonBody(body) };
  return { type: 'MultiPolygon', coordinates: splitTopLevel(stripOuterParens(body)).map(parsePolygonBody) };
}

export function parseDelimitedText(text: string, delimiter?: string): Record<string, string>[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const selected = delimiter ?? ((firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === selected && !quoted) {
      row.push(field); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some(value => value.length)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); if (row.some(value => value.length)) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function recordsWithWktToGeoJson(records: Record<string, unknown>[], geometryField?: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const record of records) {
    const key = geometryField && record[geometryField] !== undefined
      ? geometryField
      : Object.keys(record).find(name => /wkt|geometr.*wgs|geometry.*wgs|geometria_wgs/i.test(name));
    if (!key || !record[key]) continue;
    try {
      const properties = { ...record };
      const geometry = parseWktGeometry(String(record[key]));
      delete properties[key];
      features.push({ type: 'Feature', properties, geometry });
    } catch { /* skip non-polygon rows */ }
  }
  return { type: 'FeatureCollection', features };
}
