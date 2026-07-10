import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { buildRegisterPayload, syncRegisterToCrm } from '@/lib/crm/sync'

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, password } = await request.json()

    // Валидация обязательных полей
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Имя, email и пароль обязательны для заполнения' },
        { status: 400 }
      )
    }

    // Валидация пароля
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 }
      )
    }

    // Проверяем, что пароль не пустой
    if (password.trim().length === 0) {
      return NextResponse.json(
        { error: 'Пароль не может быть пустым' },
        { status: 400 }
      )
    }

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      )
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12)

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'USER'
      }
    })

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user

    void syncRegisterToCrm(
      buildRegisterPayload({
        name,
        email,
        phone,
      })
    )

    return NextResponse.json(
      { message: 'Пользователь успешно создан', user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
