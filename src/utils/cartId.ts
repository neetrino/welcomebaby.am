const CART_ID_STORAGE_KEY = 'pideh-cart-id'

function createCartId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `CART-${crypto.randomUUID()}`
  }
  return `CART-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateCartId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const existing = localStorage.getItem(CART_ID_STORAGE_KEY)
    if (existing?.trim()) return existing.trim()

    const cartId = createCartId()
    localStorage.setItem(CART_ID_STORAGE_KEY, cartId)
    return cartId
  } catch {
    return createCartId()
  }
}

export function clearCartId(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CART_ID_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}
