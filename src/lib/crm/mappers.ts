import type { CrmCartItemPayload, CrmClientPayload } from '@/lib/crm/types'
import { splitFullName } from '@/utils/nameUtils'

export function mapCrmClient(
  name: string | null | undefined,
  phone: string | null | undefined,
  email: string | null | undefined
): CrmClientPayload {
  const { first_name, last_name } = splitFullName(name)
  return {
    first_name,
    last_name,
    phone: (phone ?? '').trim(),
    email: (email ?? '').trim(),
  }
}

export function mapPaymentMethod(method: string): string {
  switch (method) {
    case 'idram':
      return 'idram'
    case 'card':
    case 'credit_card':
      return 'credit_card'
    case 'cash':
    default:
      return 'cash'
  }
}

export function mapCartItems(
  items: Array<{ product_name: string; quantity: number; price: number }>
): CrmCartItemPayload[] {
  return items.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    price: item.price,
  }))
}
