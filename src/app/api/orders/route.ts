import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { syncOrderById } from '@/lib/crm/sync'
import type { OrderSummary, OrdersListResponse } from '@/types'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

/**
 * GET /api/orders?page=1&pageSize=10
 * Returns paginated order summaries for the authenticated user.
 * Response: { items: OrderSummary[], page, pageSize, totalCount, totalPages }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    )
    const skip = (page - 1) * pageSize

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          items: {
            include: {
              product: { select: { name: true } }
            }
          }
        }
      }),
      prisma.order.count({ where: { userId: session.user.id } })
    ])

    const items: OrderSummary[] = orders.map((order) => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus ?? null,
      paymentMethod: order.paymentMethod,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.length,
      firstItemName: order.items[0]?.product.name ?? null
    }))

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    const response: OrdersListResponse = {
      items,
      page,
      pageSize,
      totalCount,
      totalPages
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Orders API error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const { name, phone, address, paymentMethod, notes, items, total, deliveryTime, deliveryTypeId, cartId } = body

    // Валидация обязательных полей
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }
    if (typeof total !== 'number' || total <= 0 || !Number.isFinite(total)) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      )
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(
        { error: 'Phone is required' },
        { status: 400 }
      )
    }

    const notesVal = notes != null && typeof notes === 'string' ? notes : null
    let deliveryTypeIdVal: string | null = null
    if (deliveryTypeId && typeof deliveryTypeId === 'string' && deliveryTypeId.trim()) {
      const exists = await prisma.deliveryType.findUnique({
        where: { id: deliveryTypeId, isActive: true },
        select: { id: true }
      })
      if (exists) deliveryTypeIdVal = deliveryTypeId
    }

    // Логируем только метаданные, без персональных данных (PII)
    logger.debug('Creating order:', { 
      hasSession: !!session, 
      userId: session?.user?.id, 
      itemsCount: items.length,
      total,
      paymentMethod,
      deliveryTime,
      items: items.map((item: { productId?: string; quantity?: number; price?: number }) => ({
        productId: item?.productId,
        quantity: item?.quantity,
        price: item?.price
      }))
    })

    // Проверяем, что все продукты существуют
    if (items.length > 0) {
      const productIds = items.map((item: any) => item.productId)
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, isAvailable: true, published: true },
        select: { id: true, name: true }
      })
      
      logger.debug('Existing products:', existingProducts)
      
      const missingProducts = productIds.filter((id: string) => 
        !existingProducts.find(p => p.id === id)
      )
      
      if (missingProducts.length > 0) {
        logger.error('Missing products:', missingProducts)
        return NextResponse.json(
          { error: `Products not found: ${missingProducts.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const paymentMethodVal = paymentMethod && typeof paymentMethod === 'string' ? paymentMethod : 'cash'
    const isOnlinePayment = paymentMethodVal === 'idram'
    const paymentStatus = isOnlinePayment ? 'PENDING' : null
    const cartIdVal =
      cartId && typeof cartId === 'string' && cartId.trim() ? cartId.trim() : null
    // Наличные/карта при получении — заказ сразу «принят», оплата потом; онлайн — PENDING до оплаты
    const orderStatus = isOnlinePayment ? 'PENDING' : 'CONFIRMED'

    // Create order (supports both authenticated and guest users)
    const order = await prisma.order.create({
      data: {
        userId: session?.user?.id ?? null,
        name: (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Guest Customer',
        status: orderStatus,
        paymentStatus,
        total,
        address: String(address).trim(),
        phone: String(phone).trim(),
        notes: notesVal,
        paymentMethod: paymentMethodVal,
        deliveryTime: deliveryTime && typeof deliveryTime === 'string' ? deliveryTime : null,
        deliveryTypeId: deliveryTypeIdVal,
        paymentData: cartIdVal ? { cartId: cartIdVal } : null,
        items: {
          create: items.map((item: { productId?: string; quantity?: number; price?: number }) => ({
            productId: String(item?.productId ?? ''),
            quantity: Math.max(1, Math.floor(Number(item?.quantity) || 1)),
            price: Number(item?.price) || 0
          }))
        }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true
              }
            }
          }
        }
      }
    })

    logger.info('Order created successfully:', order.id)

    if (!isOnlinePayment) {
      void syncOrderById(order.id, cartIdVal ?? undefined)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    // Логируем полные детали только на сервере
    logger.error('Create order API error', error)
    
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev && error instanceof Error) {
      logger.error('Error details', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
    }
    
    // В проде не раскрываем детали ошибок клиенту
    return NextResponse.json(
      { 
        error: 'Internal server error',
        ...(isDev && { details: error instanceof Error ? error.message : 'Unknown error' })
      },
      { status: 500 }
    )
  }
}
