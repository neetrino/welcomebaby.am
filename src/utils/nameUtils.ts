export function splitFullName(name: string | null | undefined): {
  first_name: string
  last_name: string
} {
  const trimmed = (name ?? '').trim()
  if (!trimmed) {
    return { first_name: 'Guest', last_name: '-' }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '-' }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}
