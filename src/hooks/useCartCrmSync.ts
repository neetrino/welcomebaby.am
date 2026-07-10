'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { CartItem } from '@/types'
import { getOrCreateCartId } from '@/utils/cartId'
import { splitFullName } from '@/utils/nameUtils'

const DEBOUNCE_MS = 3000
const THROTTLE_MS = 20000

interface UseCartCrmSyncParams {
  items: CartItem[]
  isHydrated: boolean
  getTotalPrice: () => number
}

function buildCartSnapshot(items: CartItem[]): string {
  const payload = items.map((item) => ({
    id: item.product.id,
    q: item.quantity,
    p: item.product.salePrice ?? item.product.price,
  }))
  return JSON.stringify(payload)
}

function buildSyncBody(
  items: CartItem[],
  getTotalPrice: () => number,
  session: ReturnType<typeof useSession>['data']
) {
  const cartId = getOrCreateCartId()
  const body: {
    cart_id: string
    total_amount: number
    items: Array<{ product_name: string; quantity: number; price: number }>
    client?: {
      first_name: string
      last_name: string
      phone: string
      email: string
    }
  } = {
    cart_id: cartId,
    total_amount: getTotalPrice(),
    items: items.map((item) => ({
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.salePrice ?? item.product.price,
    })),
  }

  if (session?.user?.email) {
    const { first_name, last_name } = splitFullName(session.user.name)
    body.client = {
      first_name,
      last_name,
      phone: '',
      email: session.user.email,
    }
  }

  return body
}

async function sendCartSync(
  items: CartItem[],
  getTotalPrice: () => number,
  session: ReturnType<typeof useSession>['data']
): Promise<void> {
  if (items.length === 0) return

  await fetch('/api/crm/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSyncBody(items, getTotalPrice, session)),
    keepalive: true,
  }).catch(() => {
    // CRM sync must not affect cart UX
  })
}

export function useCartCrmSync({
  items,
  isHydrated,
  getTotalPrice,
}: UseCartCrmSyncParams): void {
  const { data: session } = useSession()
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncAtRef = useRef(0)
  const lastSnapshotRef = useRef('')
  const itemsRef = useRef(items)
  const getTotalPriceRef = useRef(getTotalPrice)
  const sessionRef = useRef(session)

  itemsRef.current = items
  getTotalPriceRef.current = getTotalPrice
  sessionRef.current = session

  const runSync = async () => {
    const currentItems = itemsRef.current
    if (currentItems.length === 0) return

    const snapshot = buildCartSnapshot(currentItems)
    if (snapshot === lastSnapshotRef.current) return

    const now = Date.now()
    const elapsed = now - lastSyncAtRef.current

    if (elapsed < THROTTLE_MS) {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = setTimeout(() => {
        void runSync()
      }, THROTTLE_MS - elapsed)
      return
    }

    lastSnapshotRef.current = snapshot
    lastSyncAtRef.current = Date.now()
    await sendCartSync(currentItems, getTotalPriceRef.current, sessionRef.current)
  }

  const scheduleSync = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void runSync()
    }, DEBOUNCE_MS)
  }

  useEffect(() => {
    if (!isHydrated) return
    if (items.length === 0) {
      lastSnapshotRef.current = ''
      return
    }
    scheduleSync()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [items, isHydrated, session?.user?.email])

  useEffect(() => {
    if (!isHydrated) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && itemsRef.current.length > 0) {
        void sendCartSync(
          itemsRef.current,
          getTotalPriceRef.current,
          sessionRef.current
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current)
    }
  }, [isHydrated])
}
