'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock, CreditCard, Phone, User, Truck, Smartphone } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useSession } from 'next-auth/react'
import Footer from '@/components/Footer'
import { formatPrice } from '@/utils/priceUtils'
import { getOrCreateCartId } from '@/utils/cartId'

interface UserProfile {
  id: string
  name: string | null
  email: string
  phone: string | null
  address: string | null
}

interface DeliveryType {
  id: string
  name: string
  deliveryTime: string
  description: string
  price: number
  isActive: boolean
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart, validateCart } = useCart()
  const { data: session, status } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([])
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    deliveryTime: 'asap',
    deliveryTypeId: '',
    paymentMethod: 'cash',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Стоимость доставки из выбранного типа
  const getDeliveryPrice = () => {
    if (!formData.deliveryTypeId) return 0
    const dt = deliveryTypes.find(d => d.id === formData.deliveryTypeId)
    return dt ? dt.price : 0
  }

  // Redirect if cart is empty and validate cart
  useEffect(() => {
    if (items.length === 0) {
      console.log('Cart is empty, redirecting to cart page')
      router.push('/cart')
    } else {
      // Валидируем корзину при загрузке страницы
      validateCart()
    }
  }, [items, router, validateCart])

  // Load user profile and auto-fill form (only for authenticated users)
  useEffect(() => {
    const loadUserProfile = async () => {
      if (status === 'loading') return
      
      if (!session) {
        console.log('Guest user - no profile to load')
        return
      }

      try {
        console.log('Loading user profile for authenticated user')
        const response = await fetch('/api/user/profile')
        
        if (response.ok) {
          const profile = await response.json()
          setUserProfile(profile)
          
          // Автоматически заполняем форму данными пользователя
          setFormData(prev => ({
            ...prev,
            name: profile.name || '',
            phone: profile.phone || '',
            address: profile.address || ''
          }))
          console.log('User profile loaded and form auto-filled:', profile)
        } else if (response.status === 401) {
          console.log('User session expired, continuing as guest')
        } else {
          console.log('Profile not found, continuing as guest')
        }
      } catch (error) {
        console.log('Error loading profile, continuing as guest:', error)
      }
    }

    loadUserProfile()
  }, [session, status])

  // Загрузка типов доставки (только активные)
  useEffect(() => {
    const fetchDeliveryTypes = async () => {
      try {
        const res = await fetch('/api/delivery-types?activeOnly=true')
        if (res.ok) {
          const json = await res.json()
          const list: DeliveryType[] = json.data || []
          setDeliveryTypes(list)
          if (list.length > 0) {
            setFormData(prev => (prev.deliveryTypeId ? prev : { ...prev, deliveryTypeId: list[0].id }))
          }
        }
      } catch (err) {
        console.error('Error fetching delivery types:', err)
      }
    }
    fetchDeliveryTypes()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const scrollToFirstError = (firstErrorKey: 'name' | 'phone' | 'address') => {
    const mobileEl = document.getElementById(`checkout-field-${firstErrorKey}-mobile`)
    const desktopEl = document.getElementById(`checkout-field-${firstErrorKey}-desktop`)
    const el = (mobileEl?.offsetParent ? mobileEl : null) ?? (desktopEl?.offsetParent ? desktopEl : null) ?? mobileEl ?? desktopEl
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Անունը պարտադիր է'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Հեռախոսը պարտադիր է'
    } else if (!/^\+?[0-9\s\-\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Հեռախոսի սխալ ձևաչափ'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Հասցեն պարտադիր է'
    }

    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0
    if (!isValid) {
      const firstKey = (['name', 'phone', 'address'] as const).find(k => newErrors[k])
      if (firstKey) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToFirstError(firstKey))
        })
      }
    }
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Валидируем корзину перед отправкой
    await validateCart()
    
    // Проверяем, что корзина не пуста после валидации
    if (items.length === 0) {
      alert('Զամբյուղում հասանելի արտադրանք չկա: Խնդրում ենք ավելացնել արտադրանք զամբյուղում:')
      router.push('/products')
      return
    }

    setIsSubmitting(true)

    try {
      const orderData = {
        ...formData,
        deliveryTypeId: formData.deliveryTypeId || null,
        cartId: getOrCreateCartId(),
        items: items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.salePrice || item.product.price
        })),
        total: getTotalPrice() + getDeliveryPrice()
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || response.statusText)
      }

      const order = await response.json()

      if (formData.paymentMethod === 'idram') {
        const initRes = await fetch('/api/payments/idram/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}))
          throw new Error(err.error || 'Idram init failed')
        }
        const { formUrl, formData: idramFormData } = await initRes.json()
        // Сохраняем orderId на случай, если Idram при редиректе на FAIL_URL не добавит его в URL — тогда order-success возьмёт из sessionStorage
        if (typeof window !== 'undefined') window.sessionStorage.setItem('idram_pending_order_id', order.id)
        // Не очищаем корзину здесь — иначе useEffect увидит items.length === 0 и редирект на /cart до form.submit(); корзину очистим на order-success при возврате с Idram
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = formUrl
        Object.entries(idramFormData).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        return
      }

      clearCart()
      window.location.href = '/order-success'
    } catch (error) {
      console.error('Error submitting order:', error)
      alert('Պատվերի ձևակերպման ժամանակ սխալ է տեղի ունեցել: Խնդրում ենք կրկին փորձել։')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff' }}>
      
      {/* Отступ для fixed хедера */}
      <div className="lg:hidden h-20"></div>
      <div className="hidden lg:block h-28"></div>
      
      {/* Mobile App Style Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 pb-20 lg:pb-8">
        {/* Mobile Header */}
        <div className="lg:hidden mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <Link 
              href="/cart"
              className="flex items-center text-gray-600 hover:text-orange-500 transition-colors"
            >
              <ArrowLeft className="h-6 w-6 mr-2" />
              <span className="text-lg font-medium">զամբյուղ</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Պատվերի ձևակերպում</h1>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center space-x-4 mb-8">
          <Link 
            href="/cart"
            className="flex items-center text-gray-600 hover:text-orange-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Վերադառնալ զամբյուղ
          </Link>
          <div className="h-8 w-px bg-gray-300"></div>
          <h1 className="text-3xl font-bold text-gray-900">Պատվերի ձևակերպում</h1>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Mobile Layout */}
          <div className="lg:hidden space-y-6">
            {/* Mobile Order Form */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Առաքման տվյալներ</h2>
                {!session && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Հյուրի պատվեր
                  </span>
                )}
              </div>
                
              <div className="space-y-4">
                {/* Name */}
                <div id="checkout-field-name-mobile">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline h-4 w-4 mr-1" />
                    Անուն *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Մուտքագրեք ձեր անունը"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Phone */}
                <div id="checkout-field-phone-mobile">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Հեռախոս *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="+374 99 123 456"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                {/* Address */}
                <div id="checkout-field-address-mobile">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Առաքման հասցե *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none text-gray-900 ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Նշեք ամբողջական հասցեն"
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>

                {/* Delivery Type */}
                {deliveryTypes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Truck className="inline h-4 w-4 mr-1" />
                      Առաքման տեսակ *
                    </label>
                    <div className="space-y-3">
                      {deliveryTypes.map((dt) => (
                        <label
                          key={dt.id}
                          className={`relative flex p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                            formData.deliveryTypeId === dt.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryTypeId"
                            value={dt.id}
                            checked={formData.deliveryTypeId === dt.id}
                            onChange={handleInputChange}
                            className="sr-only"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{dt.name}</div>
                            <div className="text-sm text-gray-600">{dt.description}</div>
                            <div className="text-sm font-medium text-gray-700 mt-1">
                              {dt.price === 0 ? 'Անվճար' : `${formatPrice(dt.price)} ֏`}
                            </div>
                          </div>
                          {formData.deliveryTypeId === dt.id && (
                            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Առաքման ժամ *
                  </label>
                  <select
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900"
                  >
                    <option value="asap">Որքան հնարավոր է շուտ (20-30 րոպե)</option>
                    <option value="11:00-12:00">11:00 - 12:00</option>
                    <option value="12:00-13:00">12:00 - 13:00</option>
                    <option value="13:00-14:00">13:00 - 14:00</option>
                    <option value="14:00-15:00">14:00 - 15:00</option>
                    <option value="15:00-16:00">15:00 - 16:00</option>
                    <option value="16:00-17:00">16:00 - 17:00</option>
                    <option value="17:00-18:00">17:00 - 18:00</option>
                    <option value="18:00-19:00">18:00 - 19:00</option>
                    <option value="19:00-20:00">19:00 - 20:00</option>
                    <option value="20:00-21:00">20:00 - 21:00</option>
                  </select>
                  {errors.deliveryTime && <p className="text-red-500 text-sm mt-1">{errors.deliveryTime}</p>}
                </div>
              </div>
            </div>

            {/* Mobile Payment Method */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Վճարման եղանակ</h2>
              <div className="space-y-4">
                <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                  formData.paymentMethod === 'cash' 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">Կանխիկ</h3>
                      <p className="text-sm text-gray-600">Վճարում կուրիերին կանխիկ</p>
                    </div>
                    {formData.paymentMethod === 'cash' && (
                      <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>
                
                <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                  formData.paymentMethod === 'card' 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">Քարտ</h3>
                      <p className="text-sm text-gray-600">Վճարում քարտով տերմինալով</p>
                    </div>
                    {formData.paymentMethod === 'card' && (
                      <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>

                <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                  formData.paymentMethod === 'idram' 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="idram"
                    checked={formData.paymentMethod === 'idram'}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Smartphone className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">Idram</h3>
                      <p className="text-sm text-gray-600">Վճարում Idram հավելվածով</p>
                    </div>
                    {formData.paymentMethod === 'idram' && (
                      <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Mobile Notes */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Մեկնաբանություն</h2>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none text-gray-900"
                placeholder="Լրացուցիչ ցանկություններ պատվերի համար..."
              />
            </div>

            {/* Mobile Order Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ձեր պատվերը</h2>
              
              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-center py-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{item.product.name}</div>
                      <div className="text-xs text-gray-600">{item.quantity} հատ</div>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {formatPrice(item.product.price * item.quantity)} ֏
                    </div>
                  </div>
                ))}
                
                <div className="border-t border-gray-300 pt-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Արտադրանք</span>
                      <span>{formatPrice(getTotalPrice())} ֏</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Առաքում</span>
                      <span>{getDeliveryPrice() === 0 ? 'Անվճար' : `${formatPrice(getDeliveryPrice())} ֏`}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-300 pt-2">
                      <span>Ընդամենը</span>
                      <span>{formatPrice(getTotalPrice() + getDeliveryPrice())} ֏</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-4 rounded-xl font-semibold transition-colors text-center text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Պատվերը ձևակերպվում է...' : 'Հաստատել պատվերը'}
              </button>
              
              <p className="text-xs text-gray-500 mt-4 text-center">
                «Հաստատել պատվերը» սեղմելով՝ դուք համաձայն եք առաքման պայմաններին
              </p>
              {!session && (
                <p className="text-xs text-blue-600 mt-2 text-center">
                  💡 Պատվերից հետո կկարողանաք հաշիվ ստեղծել արագ ձևակերպման համար
                </p>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Order Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">Առաքման տվյալներ</h2>
                  {!session && (
                    <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      Հյուրի պատվեր
                    </span>
                  )}
                </div>
                
                <div className="space-y-6">
                  {/* Name */}
                  <div id="checkout-field-name-desktop">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline h-4 w-4 mr-1" />
                      Անուն *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Մուտքագրեք ձեր անունը"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div id="checkout-field-phone-desktop">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Հեռախոս *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="+374 99 123 456"
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </div>

                  {/* Address */}
                  <div id="checkout-field-address-desktop">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Առաքման հասցե *
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={3}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none text-gray-900 ${
                        errors.address ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Նշեք ամբողջական հասցեն"
                    />
                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                  </div>

                  {/* Delivery Type */}
                  {deliveryTypes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Truck className="inline h-4 w-4 mr-1" />
                        Առաքման տեսակ *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deliveryTypes.map((dt) => (
                          <label
                            key={dt.id}
                            className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg ${
                              formData.deliveryTypeId === dt.id
                                ? 'border-primary-500 bg-primary-50 shadow-md'
                                : 'border-gray-300 hover:border-primary-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="deliveryTypeId"
                              value={dt.id}
                              checked={formData.deliveryTypeId === dt.id}
                              onChange={handleInputChange}
                              className="sr-only"
                            />
                            <div className="text-center">
                              <div className="font-semibold text-gray-900 mb-1">{dt.name}</div>
                              <div className="text-sm text-gray-600 mb-2">{dt.description}</div>
                              <div className="text-sm font-medium text-gray-700">
                                {dt.price === 0 ? 'Անվճար' : `${formatPrice(dt.price)} ֏`}
                              </div>
                            </div>
                            {formData.deliveryTypeId === dt.id && (
                              <div className="absolute top-4 right-4">
                                <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delivery Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="inline h-4 w-4 mr-1" />
                      Առաքման ժամ *
                    </label>
                    <select
                      name="deliveryTime"
                      value={formData.deliveryTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-gray-900"
                    >
                      <option value="asap">Որքան հնարավոր է շուտ (20-30 րոպե)</option>
                      <option value="11:00-12:00">11:00 - 12:00</option>
                      <option value="12:00-13:00">12:00 - 13:00</option>
                      <option value="13:00-14:00">13:00 - 14:00</option>
                      <option value="14:00-15:00">14:00 - 15:00</option>
                      <option value="15:00-16:00">15:00 - 16:00</option>
                      <option value="16:00-17:00">16:00 - 17:00</option>
                      <option value="17:00-18:00">17:00 - 18:00</option>
                      <option value="18:00-19:00">18:00 - 19:00</option>
                      <option value="19:00-20:00">19:00 - 20:00</option>
                      <option value="20:00-21:00">20:00 - 21:00</option>
                    </select>
                    {errors.deliveryTime && <p className="text-red-500 text-sm mt-1">{errors.deliveryTime}</p>}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      <CreditCard className="inline h-4 w-4 mr-1" />
                      Վճարման եղանակ *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        formData.paymentMethod === 'cash' 
                          ? 'border-primary-500 bg-primary-50 shadow-md' 
                          : 'border-gray-300 hover:border-primary-300'
                      }`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={formData.paymentMethod === 'cash'}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Կանխիկ</h3>
                          <p className="text-sm text-gray-600">Վճարում կուրիերին կանխիկ առաքման ժամանակ</p>
                          {formData.paymentMethod === 'cash' && (
                            <div className="absolute top-4 right-4">
                              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                      
                      <label className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        formData.paymentMethod === 'card' 
                          ? 'border-primary-500 bg-primary-50 shadow-md' 
                          : 'border-gray-300 hover:border-primary-300'
                      }`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={formData.paymentMethod === 'card'}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CreditCard className="h-8 w-8 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Քարտ</h3>
                          <p className="text-sm text-gray-600">Վճարում քարտով կուրիերի տերմինալով</p>
                          {formData.paymentMethod === 'card' && (
                            <div className="absolute top-4 right-4">
                              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </label>

                      <label className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        formData.paymentMethod === 'idram' 
                          ? 'border-primary-500 bg-primary-50 shadow-md' 
                          : 'border-gray-300 hover:border-primary-300'
                      }`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="idram"
                          checked={formData.paymentMethod === 'idram'}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Smartphone className="h-8 w-8 text-amber-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Idram</h3>
                          <p className="text-sm text-gray-600">Վճարում Idram հավելվածով</p>
                          {formData.paymentMethod === 'idram' && (
                            <div className="absolute top-4 right-4">
                              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Մեկնաբանություն պատվերի համար
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none text-gray-900"
                      placeholder="Լրացուցիչ ցանկություններ պատվերի համար..."
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Ձեր պատվերը</h2>
                
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center py-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-sm text-gray-600">{item.quantity} հատ</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(item.product.price * item.quantity)} ֏
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t border-gray-300 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Արտադրանք</span>
                        <span>{formatPrice(getTotalPrice())} ֏</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Առաքում</span>
                        <span>{getDeliveryPrice() === 0 ? 'Անվճար' : `${formatPrice(getDeliveryPrice())} ֏`}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-300 pt-2">
                        <span>Ընդամենը</span>
                        <span>{formatPrice(getTotalPrice() + getDeliveryPrice())} ֏</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-4 rounded-xl font-semibold transition-colors text-center text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Պատվերը ձևակերպվում է...' : 'Հաստատել պատվերը'}
                </button>
                
                <p className="text-xs text-gray-500 mt-4 text-center">
                  «Հաստատել պատվերը» սեղմելով՝ դուք համաձայն եք առաքման պայմաններին
                </p>
                {!session && (
                  <p className="text-xs text-blue-600 mt-2 text-center">
                    💡 Պատվերից հետո կկարողանաք հաշիվ ստեղծել արագ ձևակերպման համար
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
      
      {/* Hide Footer on Mobile and Tablet */}
      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  )
}
