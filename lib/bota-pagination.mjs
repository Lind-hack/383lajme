// PostgREST defaults to 1,000 rows. A 400/day archive must page explicitly.
export async function readBotaPages(query, pageSize = 500) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const {data, error} = await query().range(offset, offset + pageSize - 1);
    if (error) throw new Error('Cannot read complete Bota archive');
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
  throw new Error('Bota archive exceeds the bounded reading window');
}
