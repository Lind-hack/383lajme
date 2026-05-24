type FigureDef = { name: string; wikiTitle: string };

export const CATEGORY_FIGURES: Partial<Record<string, FigureDef[]>> = {
  'Politikë': [
    { name: 'Albin Kurti',      wikiTitle: 'Albin_Kurti' },
    { name: 'Vjosa Osmani',     wikiTitle: 'Vjosa_Osmani' },
    { name: 'Hashim Thaçi',     wikiTitle: 'Hashim_Tha%C3%A7i' },
    { name: 'Ramush Haradinaj', wikiTitle: 'Ramush_Haradinaj' },
    { name: 'Bedri Hamza',      wikiTitle: 'Bedri_Hamza' },
  ],
  'Sport': [
    { name: 'Vedat Muriqi',   wikiTitle: 'Vedat_Muriqi' },
    { name: 'Edon Zhegrova',  wikiTitle: 'Edon_Zhegrova' },
    { name: 'Milot Rashica',  wikiTitle: 'Milot_Rashica' },
    { name: 'Bersant Celina', wikiTitle: 'Bersant_Celina' },
    { name: 'Dardan Berisha', wikiTitle: 'Dardan_Berisha' },
  ],
  'Showbiz': [
    { name: 'Dua Lipa',    wikiTitle: 'Dua_Lipa' },
    { name: 'Rita Ora',    wikiTitle: 'Rita_Ora' },
    { name: 'Era Istrefi', wikiTitle: 'Era_Istrefi' },
  ],
};

export type ResolvedFigure = { name: string; imageUrl: string | null };

async function fetchFigureImage(wikiTitle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function resolveCategoryFigures(categoryName: string): Promise<ResolvedFigure[]> {
  const defs = CATEGORY_FIGURES[categoryName];
  if (!defs?.length) return [];
  return Promise.all(
    defs.map(async (f) => ({ name: f.name, imageUrl: await fetchFigureImage(f.wikiTitle) }))
  );
}
