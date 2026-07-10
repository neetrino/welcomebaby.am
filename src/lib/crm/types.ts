export interface CrmClientPayload {
  first_name: string
  last_name: string
  phone: string
  email: string
}

export interface CrmCartItemPayload {
  product_name: string
  quantity: number
  price: number
}

export interface CrmRegisterPayload {
  first_name: string
  last_name: string
  phone: string
  email: string
}

export interface CrmCartPayload {
  cart_id: string
  client?: CrmClientPayload
  total_amount: number
  items: CrmCartItemPayload[]
}

export interface CrmOrderDetailsPayload {
  order_number: string
  total_amount: number
  payment_method: string
}

export interface CrmOrderPayload {
  cart_id?: string
  client: CrmClientPayload
  order: CrmOrderDetailsPayload
  items: CrmCartItemPayload[]
}

export interface CrmLeadPayload {
  first_name: string
  last_name: string
  phone: string
  email: string
  message: string
}

export interface CrmSuccessResponse {
  success: boolean
  message: string
  client_id?: number
  cart_id?: string
  order_id?: number
  order_number?: string
}
