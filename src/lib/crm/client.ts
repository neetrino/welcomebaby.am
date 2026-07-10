import { logger } from '@/lib/logger'
import { getCrmConfig } from '@/lib/crm/config'
import type { CrmSuccessResponse } from '@/lib/crm/types'

type CrmEndpoint = 'register' | 'cart' | 'orders' | 'leads'

export async function postToCrm<TBody extends object>(
  endpoint: CrmEndpoint,
  body: TBody
): Promise<CrmSuccessResponse | null> {
  const config = getCrmConfig()
  if (!config.enabled) {
    logger.debug('CRM sync skipped: disabled or missing API key')
    return null
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/${endpoint}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.warn('CRM request failed', {
        endpoint,
        status: response.status,
        error: errorText.slice(0, 500),
      })
      return null
    }

    return (await response.json()) as CrmSuccessResponse
  } catch (error) {
    logger.error(`CRM request error: ${endpoint}`, error)
    return null
  }
}
