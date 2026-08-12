const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('ca')
  .replace(/[’'`´]/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/^(el|la|els|les|l)\s+/, '')
  .replace(/\s+/g, ' ')
  .trim();

export const VALLDOREIX_BARRIS = [
  { canonical: 'Aqualonga', aliases: [] },
  { canonical: "Ca n’Enric La Miranda", aliases: ["Ca n'Enric La Miranda", "Ca n’Enric-La Miranda", "Ca n'Enric-La Miranda"] },
  { canonical: 'Can Cadena', aliases: [] },
  { canonical: 'Colònia Montserrat', aliases: ['Colonia Montserrat'] },
  { canonical: 'La Barceloneta', aliases: ['Barceloneta'] },
  { canonical: 'La Guinardera - Can Casulleras', aliases: ['La Guinardera Can Casulleras', 'Guinardera - Can Casulleras', 'Guinardera Can Casulleras', 'Can Casulleras', 'Can Casulleres'] },
  { canonical: 'Les Bobines', aliases: ['Bobines'] },
  { canonical: 'Mas Fuster', aliases: [] },
  { canonical: 'Mas Roig', aliases: [] },
  { canonical: 'Monmany', aliases: ['Can Monmany', 'Montmany'] },
  { canonical: 'Regadiu', aliases: [] },
  { canonical: 'Rossinyol', aliases: [] },
  { canonical: 'Sant Jaume', aliases: [] },
];

const aliasToCanonical = new Map();
for (const entry of VALLDOREIX_BARRIS) {
  for (const alias of [entry.canonical, ...entry.aliases]) aliasToCanonical.set(normalize(alias), entry.canonical);
}

export function canonicalValldoreixName(value) {
  return aliasToCanonical.get(normalize(value));
}

export function partitionSantCugatValldoreix(features) {
  const valldoreix = [];
  const santCugat = [];
  const found = new Set();
  for (const feature of features) {
    const canonical = canonicalValldoreixName(feature?.properties?.name);
    if (!canonical) {
      santCugat.push(feature);
      continue;
    }
    found.add(canonical);
    valldoreix.push({
      ...feature,
      properties: { ...feature.properties, name: canonical, officialName: canonical },
    });
  }
  const expected = VALLDOREIX_BARRIS.map(item => item.canonical);
  const missing = expected.filter(name => !found.has(name));
  return {
    santCugat,
    valldoreix,
    found: [...found],
    missing,
    complete: found.size === expected.length,
    hasAny: found.size > 0,
  };
}
