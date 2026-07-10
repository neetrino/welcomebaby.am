'use client'

import { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { Product, CartItem, CartContextType } from '@/types'
import { useHydration } from './useHydration'
import { useCartCrmSync } from './useCartCrmSync'
import { clearCartId } from '@/utils/cartId'

// Ключ для localStorage
const CART_STORAGE_KEY = 'pideh-cart'

// Функции для работы с localStorage
const saveCartToStorage = (cart: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  } catch (error) {
    console.warn('Не удалось сохранить корзину в localStorage:', error)
  }
}

const loadCartFromStorage = (): CartItem[] => {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (error) {
    console.warn('Не удалось загрузить корзину из localStorage:', error)
    return []
  }
}

const clearCartFromStorage = () => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY)
  } catch (error) {
    console.warn('Не удалось очистить корзину из localStorage:', error)
  }
}

// Типы для reducer
type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity?: number } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] }

// Начальное состояние
const initialState: CartItem[] = []

// Reducer для управления состоянием корзины
function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  let newState: CartItem[]
  
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity = 1 } = action.payload
      const existingItem = state.find(item => item.product.id === product.id)
      
      if (existingItem) {
        newState = state.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        newState = [...state, { product, quantity }]
      }
      break
    }
    
    case 'REMOVE_ITEM': {
      newState = state.filter(item => item.product.id !== action.payload.productId)
      break
    }
    
    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload
      
      if (quantity <= 0) {
        newState = state.filter(item => item.product.id !== productId)
      } else {
        newState = state.map(item =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        )
      }
      break
    }
    
    case 'CLEAR_CART':
      newState = []
      clearCartFromStorage()
      clearCartId()
      break
    
    case 'LOAD_CART':
      newState = action.payload
      break
    
    default:
      return state
  }
  
  // Сохраняем в localStorage после каждого изменения
  saveCartToStorage(newState)
  return newState
}

// Создание контекста
const CartContext = createContext<CartContextType | undefined>(undefined)

// Провайдер контекста
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, initialState)
  const isHydrated = useHydration()

  // Загружаем корзину из localStorage при инициализации
  useEffect(() => {
    if (isHydrated) {
      const savedCart = loadCartFromStorage()
      if (savedCart.length > 0) {
        dispatch({ type: 'LOAD_CART', payload: savedCart })
      }
    }
  }, [isHydrated])

  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      const price = item.product.salePrice || item.product.price
      return total + (price * item.quantity)
    }, 0)
  }

  useCartCrmSync({ items, isHydrated, getTotalPrice })

  const addItem = (product: Product, quantity: number = 1) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, quantity } })
  }

  const removeItem = (productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId } })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } })
  }

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' })
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  // Функция для валидации корзины (удаляет несуществующие продукты)
  const validateCart = async () => {
    if (items.length === 0) return

    try {
      const productIds = items.map(item => item.product.id)
      const response = await fetch('/api/products/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      })

      if (response.ok) {
        const { validIds } = await response.json()
        const invalidItems = items.filter(item => !validIds.includes(item.product.id))
        
        if (invalidItems.length > 0) {
          console.warn('Удаляем несуществующие продукты из корзины:', invalidItems.map(item => item.product.name))
          // Удаляем несуществующие продукты
          invalidItems.forEach(item => {
            dispatch({ type: 'REMOVE_ITEM', payload: { productId: item.product.id } })
          })
        }
      }
    } catch (error) {
      console.warn('Не удалось валидировать корзину:', error)
    }
  }

  const value: CartContextType = {
    items: isHydrated ? items : [], // На сервере всегда пустая корзина
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    validateCart,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

// Хук для использования контекста корзины
export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
