import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface PayPalConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  environment: 'sandbox' | 'production'
}

interface CreateOrderRequest {
  action: 'create-order'
  amount: number
  currency: string
  description?: string
  customerEmail: string
  customerName?: string
  userId?: string
  metadata?: Record<string, any>
}

interface CaptureOrderRequest {
  action: 'capture-order'
  orderId: string
  userId?: string
}

interface OrderStatusRequest {
  action: 'order-status'
  orderId: string
}

type PayPalRequest = CreateOrderRequest | CaptureOrderRequest | OrderStatusRequest

class PayPalAPI {
  private config: PayPalConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: PayPalConfig) {
    this.config = config
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token (with 5-minute buffer)
    if (this.accessToken && Date.now() < (this.tokenExpiry - 300000)) {
      console.log('🔑 Using cached PayPal access token')
      return this.accessToken
    }

    console.log('🔑 Requesting new PayPal access token...')
    const auth = btoa(`${this.config.clientId}:${this.config.clientSecret}`)
    
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
        },
        body: 'grant_type=client_credentials'
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ PayPal token error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`PayPal authentication failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000)
      
      console.log('✅ PayPal access token obtained successfully')
      return this.accessToken
    } catch (error) {
      console.error('💥 Error getting PayPal access token:', error)
      throw error
    }
  }

  async createOrder(orderData: CreateOrderRequest): Promise<any> {
    try {
      const accessToken = await this.getAccessToken()
      
      // Validate and format amount
      const amount = Number(orderData.amount)
      if (amount <= 0 || !Number.isFinite(amount)) {
        throw new Error('Invalid amount: must be a positive number')
      }

      // Format amount based on currency
      const formattedAmount = this.formatAmount(amount, orderData.currency)
      
      // Generate unique request ID
      const requestId = `dw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const payload = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: requestId,
          amount: {
            currency_code: orderData.currency.toUpperCase(),
            value: formattedAmount
          },
          description: orderData.description || 'Dritchwear Purchase',
          custom_id: orderData.userId || `guest_${Date.now()}`,
        }],
        application_context: {
          brand_name: 'Dritchwear',
          landing_page: 'NO_PREFERENCE',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: 'https://dritchwear.com/payment/success',
          cancel_url: 'https://dritchwear.com/payment/cancel'
        }
      }

      console.log('📤 Creating PayPal order:', {
        amount: formattedAmount,
        currency: orderData.currency,
        requestId
      })

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'PayPal-Request-Id': requestId,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ PayPal create order error:', {
          status: response.status,
          statusText: response.statusText,
          error: error
        })
        throw new Error(`Failed to create PayPal order: ${response.status} - ${error}`)
      }

      const result = await response.json()
      console.log('✅ PayPal order created successfully:', result.id)
      return result
    } catch (error) {
      console.error('💥 Error in createOrder:', error)
      throw error
    }
  }

  async captureOrder(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken()
      
      console.log('💰 Capturing PayPal order:', orderId)

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'PayPal-Request-Id': `dw-capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          'Prefer': 'return=representation',
        }
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ PayPal capture error:', {
          orderId,
          status: response.status,
          statusText: response.statusText,
          error: error
        })
        throw new Error(`Failed to capture PayPal order: ${response.status} - ${error}`)
      }

      const result = await response.json()
      
      // Extract capture details
      const capture = result.purchase_units?.[0]?.payments?.captures?.[0]
      
      console.log('✅ PayPal order captured successfully:', {
        orderId,
        transactionId: capture?.id
      })
      
      return result
    } catch (error) {
      console.error('💥 Error in captureOrder:', error)
      throw error
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken()
      
      console.log('📋 Getting PayPal order status:', orderId)

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ PayPal order status error:', {
          orderId,
          status: response.status,
          error: error
        })
        throw new Error(`Failed to get PayPal order status: ${response.status} - ${error}`)
      }

      const result = await response.json()
      console.log('✅ PayPal order status retrieved:', {
        orderId,
        status: result.status
      })
      
      return result
    } catch (error) {
      console.error('💥 Error in getOrderStatus:', error)
      throw error
    }
  }

  private formatAmount(amount: number, currency: string): string {
    // Currencies that don't use decimal places
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD']
    
    if (noDecimalCurrencies.includes(currency.toUpperCase())) {
      return Math.round(amount).toString()
    }
    
    return amount.toFixed(2)
  }
}

function getPayPalConfig(): PayPalConfig {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  const environment = (Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox') as 'sandbox' | 'production'
  
  console.log('⚙️ PayPal Configuration Check:', {
    clientId: clientId ? `${clientId.substring(0, 10)}...` : '❌ NOT SET',
    clientSecret: clientSecret ? '✅ SET' : '❌ NOT SET',
    environment: environment
  })

  if (!clientId || !clientSecret) {
    throw new Error('❌ PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.')
  }

  const baseUrl = environment === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

  console.log('🌐 Using PayPal API URL:', baseUrl)

  return { clientId, clientSecret, baseUrl, environment }
}

function validateCurrency(currency: string): boolean {
  const supportedCurrencies = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 
    'INR', 'ZAR', 'KES', 'GHS', 'SGD', 'HKD', 'MXN', 'BRL',
    'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'PHP',
    'THB', 'TWD', 'NZD'
  ]
  return supportedCurrencies.includes(currency.toUpperCase())
}

async function validateRequest(request: Request): Promise<PayPalRequest> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }

  try {
    return await request.json() as PayPalRequest;
  } catch (error) {
    console.error('💥 Failed to parse JSON:', error);
    throw new Error('Invalid JSON in request body');
  }
}


serve(async (req) => {
  const timestamp = new Date().toISOString()
  const requestId = Math.random().toString(36).substr(2, 8)
  
  console.log(`🚀 [${timestamp}] [${requestId}] PayPal Function called: ${req.method} ${req.url}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] Handling CORS preflight request`)
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST and GET methods
    if (!['POST', 'GET'].includes(req.method)) {
      throw new Error(`Method ${req.method} not allowed. Only POST and GET requests are supported.`)
    }

    // Initialize PayPal API
    const paypalConfig = getPayPalConfig()
    const paypal = new PayPalAPI(paypalConfig)

    // Handle GET requests (for order status)
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const orderId = url.searchParams.get('orderId')
      
      if (!orderId) {
        throw new Error('Missing orderId parameter for GET request')
      }

      const orderStatus = await paypal.getOrderStatus(orderId)
      
      return new Response(
        JSON.stringify({
          success: true,
          order: orderStatus,
          requestId: requestId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Handle POST requests
    const body = await validateRequest(req)
    console.log(`[${requestId}] 🔎 Parsed request body:`, JSON.stringify(body, null, 2));

    console.log(`📥 [${requestId}] Request action: ${body.action}`)

    switch (body.action) {
      case 'create-order': {
        const { amount, currency, description, customerEmail, customerName, userId } = body

        // Validate required fields
        console.log(`[${requestId}] 🚨 Skipped validation - Testing manual inputs`);


        if (amount <= 0) {
          throw new Error('Amount must be greater than 0')
        }

        // Validate currency
        if (!validateCurrency(currency)) {
          throw new Error(`Unsupported currency: ${currency}`)
        }

        console.log(`💳 [${requestId}] Creating order: ${currency} ${amount} for ${customerEmail}`)

        // Create PayPal order
        const order = await paypal.createOrder({
          action: 'create-order',
          amount,
          currency,
          description,
          customerEmail,
          customerName,
          userId
        })

        // Find the approval URL
        const approvalUrl = order.links?.find((link: any) => link.rel === 'approve')?.href

        if (!approvalUrl) {
          throw new Error('No approval URL found in PayPal response')
        }

        console.log(`🎯 [${requestId}] Order created successfully with approval URL`)

        return new Response(
          JSON.stringify({
            success: true,
            orderId: order.id,
            approvalUrl: approvalUrl,
            order: order,
            requestId: requestId
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'capture-order': {
        const { orderId } = body

        if (!orderId) {
          throw new Error('Missing required field: orderId')
        }

        console.log(`💰 [${requestId}] Capturing payment for order: ${orderId}`)

        // Capture the payment
        const captureResult = await paypal.captureOrder(orderId)
        
        // Extract transaction details
        const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0]
        const transactionId = capture?.id

        if (!transactionId) {
          throw new Error('No transaction ID found in capture result')
        }

        console.log(`🎉 [${requestId}] Payment captured successfully: ${transactionId}`)
        
        return new Response(
          JSON.stringify({
            success: true,
            captureResult,
            transactionId,
            requestId: requestId
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'order-status': {
        const { orderId } = body

        if (!orderId) {
          throw new Error('Missing required field: orderId')
        }

        const orderStatus = await paypal.getOrderStatus(orderId)
        
        return new Response(
          JSON.stringify({
            success: true,
            order: orderStatus,
            requestId: requestId
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      default:
        throw new Error(`Unknown action: ${body.action}`)
    }

  } catch (error) {
    console.error(`💥 [${requestId}] PayPal Function Error:`, error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const statusCode = errorMessage.includes('not found') ? 404 : 
                      errorMessage.includes('not allowed') ? 405 : 
                      errorMessage.includes('credentials not configured') ? 500 : 400

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId: requestId,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode
      }
    )
  }
})