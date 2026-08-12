function splitTopLevel(value) {
  const parts = [];
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

function stripOuterParens(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return trimmed;
  return trimmed.slice(1, -1).trim();
}

function parseCoordinateSequence(value) {
  return splitTopLevel(value).map(token => {
    const values = token.trim().split(/\s+/).map(Number);
    if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) {
      throw new Error(`Invalid WKT coordinate: ${token}`);
    }
    return [values[0], values[1]];
  });
}

function parsePolygonBody(body) {
  const ringsBody = stripOuterParens(body);
  return splitTopLevel(ringsBody).map(ring => parseCoordinateSequence(stripOuterParens(ring)));
}

export function parseWktGeometry(raw) {
  if (typeof raw !== 'string') throw new Error('WKT geometry must be text.');
  const text = raw.trim();
  const match = /^\s*(POLYGON|MULTIPOLYGON)\s*(?:Z|M|ZM)?\s*(\(.+\))\s*$/is.exec(text);
  if (!match) throw new Error('Only POLYGON and MULTIPOLYGON WKT geometries are supported.');
  const [, type, body] = match;
  if (type.toUpperCase() === 'POLYGON') {
    return { type: 'Polygon', coordinates: parsePolygonBody(body) };
  }
  const polygonsBody = stripOuterParens(body);
  return {
    type: 'MultiPolygon',
    coordinates: splitTopLevel(polygonsBody).map(polygon => parsePolygonBody(polygon)),
  };
}

export function parseDelimitedText(text, delimiter = ';') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(value => value.length)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some(value => value.length)) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function recordsWithWktToGeoJson(records, geometryField) {
  const features = [];
  for (const record of records) {
    const key = geometryField && record[geometryField] !== undefined
      ? geometryField
      : Object.keys(record).find(name => /wkt|geometr.*wgs|geometry.*wgs|geometria_wgs/i.test(name));
    if (!key || !record[key]) continue;
    try {
      const geometry = parseWktGeometry(String(record[key]));
      const properties = { ...record };
      delete properties[key];
      features.push({ type: 'Feature', properties, geometry });
    } catch {
      // Ignore rows without a polygonal WKT geometry.
    }
  }
  return { type: 'FeatureCollection', features };
}
