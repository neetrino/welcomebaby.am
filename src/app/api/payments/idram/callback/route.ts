import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getIdramCredentials, verifyIdramChecksum } from '@/lib/payments/idram'
import { syncOrderById } from '@/lib/crm/sync'

const PLAIN_OK = () =>
  new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })

const PLAIN_ERR = (msg: string, status: number) =>
  new Response(msg, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const data = Object.fromEntries(formData.entries()) as Record<string, string>

    logger.debug('Idram callback', { keys: Object.keys(data) })

    const credentials = getIdramCredentials()
    if (!credentials.recAccount || !credentials.secretKey) {
      logger.error('Idram callback: credentials not configured')
      return PLAIN_ERR('Invalid configuration', 500)
    }

    const recAccount = (data.EDP_REC_ACCOUNT ?? '').trim()
    if (recAccount !== credentials.recAccount) {
      logger.error('Idram callback: invalid EDP_REC_ACCOUNT', { recAccount })
      return PLAIN_ERR('Invalid merchant account', 400)
    }

    if (data.EDP_PRECHECK === 'YES') {
      const billNo = (data.EDP_BILL_NO ?? '').trim()
      const amount = parseFloat(data.EDP_AMOUNT ?? '0')
      if (!billNo) return PLAIN_ERR('Missing EDP_BILL_NO', 400)

      const order = await prisma.order.findUnique({ where: { id: billNo } })
      if (!order) {
        logger.error('Idram precheck: order not found', { billNo })
        return PLAIN_ERR('Order not found', 400)
      }
      const orderAmount = parseFloat(order.total.toFixed(2))
      if (Number.isNaN(amount) || Math.abs(amount - orderAmount) > 0.01) {
        logger.error('Idram precheck: amount mismatch', { amount, orderAmount })
        return PLAIN_ERR('Amount mismatch', 400)
      }
      return PLAIN_OK()
    }

    if (!data.EDP_PAYER_ACCOUNT || !data.EDP_CHECKSUM || !data.EDP_TRANS_ID) {
      logger.error('Idram callback: missing confirmation fields')
      return PLAIN_ERR('Invalid request', 400)
    }

    const billNo = (data.EDP_BILL_NO ?? '').trim()
    const payerAccount = data.EDP_PAYER_ACCOUNT
    const amountStr = data.EDP_AMOUNT ?? ''
    const transId = data.EDP_TRANS_ID
    const transDate = data.EDP_TRANS_DATE ?? ''
    const checksum = data.EDP_CHECKSUM
    if (!billNo) return PLAIN_ERR('Missing EDP_BILL_NO', 400)

    const order = await prisma.order.findUnique({ where: { id: billNo } })
    if (!order) {
      logger.error('Idram confirm: order not found', { billNo })
      return PLAIN_ERR('Order not found', 400)
    }

    const orderAmountStr = order.total.toFixed(2)
    const paymentAmount = parseFloat(amountStr)
    const orderAmount = parseFloat(orderAmountStr)
    if (Number.isNaN(paymentAmount) || Math.abs(paymentAmount - orderAmount) > 0.01) {
      logger.error('Idram confirm: amount mismatch', { paymentAmount, orderAmount })
      return PLAIN_ERR('Amount mismatch', 400)
    }

    const valid = verifyIdramChecksum({
      recAccount,
      amountFromOrder: orderAmountStr,
      secretKey: credentials.secretKey,
      billNo,
      payerAccount,
      transId,
      transDate,
      receivedChecksum: checksum,
    })
    if (!valid) {
      logger.error('Idram confirm: invalid checksum', { billNo })
      await prisma.order.update({
        where: { id: billNo },
        data: { paymentStatus: 'FAILED', paymentId: transId },
      })
      return PLAIN_ERR('Invalid checksum', 400)
    }

    // Idempotency: already paid (SUCCESS — как в Bank-integration-shop; PAID — обратная совместимость)
    if (order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'PAID') {
      logger.debug('Idram confirm: already paid', { billNo })
      return PLAIN_OK()
    }

    // Как в Bank-integration-shop: status CONFIRMED, paymentStatus SUCCESS, paymentId = EDP_TRANS_ID
    await prisma.order.update({
      where: { id: billNo },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        paymentId: transId,
        paymentData: {
          ...(order.paymentData && typeof order.paymentData === 'object'
            ? (order.paymentData as Record<string, unknown>)
            : {}),
          payerAccount,
          transDate,
          amount: paymentAmount,
        },
      },
    })
    logger.info('Idram payment confirmed', { billNo, transId })
    void syncOrderById(billNo)
    return PLAIN_OK()
  } catch (error) {
    logger.error('Idram callback error', error)
    return PLAIN_ERR('Internal server error', 500)
  }
}
