import { NextRequest, NextResponse } from 'next/server'
import { syncLeadToCrm } from '@/lib/crm/sync'
import type { CrmLeadPayload } from '@/lib/crm/types'

function parseLeadPayload(body: unknown): CrmLeadPayload | null {
  if (!body || typeof body !== 'object') return null
  const data = body as Record<string, unknown>

  const fields = ['first_name', 'last_name', 'phone', 'email', 'message'] as const
  for (const field of fields) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      return null
    }
  }

  return {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    message: data.message.trim(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const payload = parseLeadPayload(body)

    if (!payload) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const synced = await syncLeadToCrm(payload)
    if (!synced) {
      return NextResponse.json(
        { error: 'Failed to send message. Please try again later.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
