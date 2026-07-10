export interface CrmConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
}

export function getCrmConfig(): CrmConfig {
  const apiKey = process.env.CRM_WEBSITE_API_KEY?.trim() ?? ''
  const baseUrl =
    process.env.CRM_WEBSITE_API_URL?.trim() ??
    'https://crm.welcomebaby.am/api/webhooks/website'
  const enabled =
    process.env.CRM_ENABLED !== 'false' && apiKey.length > 0

  return { enabled, baseUrl, apiKey }
}
