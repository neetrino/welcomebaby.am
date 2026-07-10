import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { postToCrm } from '@/lib/crm/client'
import { mapCrmClient, mapPaymentMethod, splitFullName } from '@/lib/crm/mappers'
import type {
  CrmCartPayload,
  CrmLeadPayload,
  CrmOrderPayload,
  CrmRegisterPayload,
} from '@/lib/crm/types'

interface PaymentDataRecord {
  cartId?: string
  crmSynced?: boolean
  [key: string]: unknown
}

function readPaymentData(value: unknown): PaymentDataRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as PaymentDataRecord
  }
  return {}
}

export async function syncRegisterToCrm(payload: CrmRegisterPayload): Promise<void> {
  const result = await postToCrm('register', payload)
  if (result?.success) {
    logger.info('CRM register synced', { client_id: result.client_id })
  }
}

export async function syncCartToCrm(payload: CrmCartPayload): Promise<void> {
  const result = await postToCrm('cart', payload)
  if (result?.success) {
    logger.debug('CRM cart synced', { cart_id: result.cart_id ?? payload.cart_id })
  }
}

export async function syncLeadToCrm(payload: CrmLeadPayload): Promise<boolean> {
  const result = await postToCrm('leads', payload)
  if (result?.success) {
    logger.info('CRM lead synced', { client_id: result.client_id })
    return true
  }
  return false
}

export async function syncOrderById(
  orderId: string,
  cartIdOverride?: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
      user: { select: { email: true, name: true, phone: true } },
    },
  })

  if (!order) {
    logger.warn('CRM order sync skipped: order not found', { orderId })
    return
  }

  const paymentData = readPaymentData(order.paymentData)
  if (paymentData.crmSynced) {
    logger.debug('CRM order sync skipped: already synced', { orderId })
    return
  }

  const cartId = cartIdOverride ?? paymentData.cartId
  const email = order.user?.email ?? ''
  const client = mapCrmClient(
    order.name || order.user?.name,
    order.phone || order.user?.phone,
    email
  )

  const payload: CrmOrderPayload = {
    ...(cartId ? { cart_id: cartId } : {}),
    client,
    order: {
      order_number: `WEB-${order.id}`,
      total_amount: order.total,
      payment_method: mapPaymentMethod(order.paymentMethod),
    },
    items: order.items.map((item) => ({
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.price,
    })),
  }

  const result = await postToCrm('orders', payload)
  if (!result?.success) return

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentData: {
        ...paymentData,
        ...(cartId ? { cartId } : {}),
        crmSynced: true,
      },
    },
  })

  logger.info('CRM order synced', {
    orderId,
    crm_order_id: result.order_id,
    order_number: result.order_number,
  })
}

export function buildRegisterPayload(input: {
  name: string
  email: string
  phone?: string | null
}): CrmRegisterPayload {
  const { first_name, last_name } = splitFullName(input.name)
  return {
    first_name,
    last_name,
    phone: (input.phone ?? '').trim(),
    email: input.email.trim(),
  }
}
