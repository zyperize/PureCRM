export function requireMutationRow(data, message) {
  if (!data) {
    throw new Error(message)
  }
  return data
}

export function requireMutationRows(data, expectedCount, message) {
  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new Error(message)
  }
  return data
}

export async function fetchAllRows(buildQuery, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await buildQuery().range(from, to)
    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}
