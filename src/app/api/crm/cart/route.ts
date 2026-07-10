import { NextRequest, NextResponse } from 'next/server'
import { syncCartToCrm } from '@/lib/crm/sync'
import type { CrmCartPayload } from '@/lib/crm/types'

function isValidClient(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const client = value as Record<string, unknown>
  return (
    typeof client.first_name === 'string' &&
    typeof client.last_name === 'string' &&
    typeof client.phone === 'string' &&
    typeof client.email === 'string'
  )
}

function parseCartPayload(body: unknown): CrmCartPayload | null {
  if (!body || typeof body !== 'object') return null
  const data = body as Record<string, unknown>

  if (typeof data.cart_id !== 'string' || !data.cart_id.trim()) return null
  if (typeof data.total_amount !== 'number' || data.total_amount < 0) return null
  if (!Array.isArray(data.items) || data.items.length === 0) return null

  const items = data.items.map((item) => {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    if (
      typeof row.product_name !== 'string' ||
      typeof row.quantity !== 'number' ||
      typeof row.price !== 'number'
    ) {
      return null
    }
    return {
      product_name: row.product_name,
      quantity: row.quantity,
      price: row.price,
    }
  })

  if (items.some((item) => item === null)) return null

  const payload: CrmCartPayload = {
    cart_id: data.cart_id.trim(),
    total_amount: data.total_amount,
    items: items as CrmCartPayload['items'],
  }

  if (data.client !== undefined) {
    if (!isValidClient(data.client)) return null
    payload.client = data.client as CrmCartPayload['client']
  }

  return payload
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const payload = parseCartPayload(body)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid cart payload' }, { status: 400 })
    }

    await syncCartToCrm(payload)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
