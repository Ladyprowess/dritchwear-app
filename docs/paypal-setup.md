# PayPal Production Setup Guide

## 🚀 Production-Ready PayPal Integration

This guide covers the complete setup for a production-ready PayPal integration using Supabase Edge Functions.

## 📋 Prerequisites

1. **PayPal Business Account** - Verified and approved
2. **Supabase Project** - With Edge Functions enabled
3. **Domain Setup** - For return URLs and webhooks
4. **SSL Certificate** - Required for production

## 🏗️ Architecture Overview

```
Mobile App → Supabase Edge Function → PayPal API → Database Logging
     ↓              ↓                    ↓              ↓
  UI/UX         Security &           Payment         Transaction
 Component      Validation          Processing        Records
```

## 🔧 PayPal Business Account Setup

### 1. Create Production App
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Switch to **Live** environment
3. Create new app with these settings:
   - **App Type**: Default Application
   - **Environment**: Live
   - **Features**: Accept Payments, Future Payments

### 2. Configure App Settings
```json
{
  "app_name": "Dritchwear Production",
  "return_url": "https://dritchwear.com/payment/success",
  "cancel_url": "https://dritchwear.com/payment/cancel",
  "webhook_url": "https://your-project.supabase.co/functions/v1/paypal-payment"
}
```

### 3. Note Your Credentials
- **Client ID**: `AYour_Live_Client_ID_Here`
- **Client Secret**: `EYour_Live_Client_Secret_Here`

## ⚙️ Supabase Configuration

### 1. Environment Variables
Set these in your Supabase project settings:

```bash
# PayPal Production Configuration
PAYPAL_CLIENT_ID=AYour_Live_Client_ID_Here
PAYPAL_CLIENT_SECRET=EYour_Live_Client_Secret_Here
PAYPAL_ENVIRONMENT=production

# Optional: Webhook Configuration
PAYPAL_WEBHOOK_ID=your_webhook_id_here
```

### 2. Database Setup
The PayPal transactions table is already created via migration:
- Logs all PayPal activities
- Tracks order creation, captures, and webhooks
- Provides audit trail for debugging

### 3. Edge Function Deployment
The function is automatically deployed with these features:
- ✅ Production-grade error handling
- ✅ Comprehensive logging
- ✅ Transaction recording
- ✅ Security validations
- ✅ CORS support
- ✅ Request ID tracking

## 🔒 Security Features

### 1. Authentication & Authorization
- Service role access for database operations
- User ID validation for transactions
- Request validation and sanitization

### 2. Error Handling
- Detailed error logging without exposing sensitive data
- Graceful failure handling
- Retry mechanisms for transient errors

### 3. Data Protection
- No sensitive data in logs
- Encrypted communication (HTTPS)
- Secure credential storage

## 🧪 Testing Strategy

### 1. Sandbox Testing
```bash
# Use sandbox for development
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
```

### 2. Production Testing
1. **Small Amount Tests**: Start with $0.01 USD
2. **Currency Tests**: Test all supported currencies
3. **Error Scenarios**: Test network failures, cancellations
4. **Webhook Tests**: Verify webhook delivery and processing

### 3. Load Testing
- Test concurrent payment processing
- Verify database performance under load
- Monitor Edge Function response times

## 📊 Monitoring & Analytics

### 1. Transaction Logging
All PayPal activities are logged in the `paypal_transactions` table:
```sql
SELECT 
  paypal_order_id,
  amount,
  currency,
  status,
  transaction_type,
  created_at
FROM paypal_transactions
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 2. Error Monitoring
Monitor Edge Function logs for:
- Failed payment attempts
- API errors
- Network timeouts
- Invalid requests

### 3. Performance Metrics
Track:
- Payment success rate
- Average processing time
- Currency distribution
- Error frequency

## 🚨 Error Handling & Recovery

### 1. Common Error Scenarios
- **Network Timeouts**: Automatic retry with exponential backoff
- **Invalid Amounts**: Client-side validation + server validation
- **Currency Issues**: Comprehensive currency support validation
- **PayPal API Errors**: Detailed error mapping and user-friendly messages

### 2. Recovery Procedures
- **Failed Captures**: Manual retry via admin interface
- **Stuck Orders**: Order status checking and resolution
- **Database Issues**: Transaction rollback and retry mechanisms

## 🔄 Webhook Configuration (Optional)

### 1. Setup Webhooks
Configure these events in PayPal Dashboard:
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

### 2. Webhook Verification
```typescript
// Implement webhook signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  // PayPal webhook verification logic
  return true; // Implement actual verification
}
```

## 📈 Performance Optimization

### 1. Edge Function Optimization
- Connection pooling for PayPal API
- Token caching (5-minute buffer)
- Efficient error handling
- Minimal payload sizes

### 2. Database Optimization
- Indexed queries for transaction lookups
- Efficient logging without blocking payment flow
- Regular cleanup of old transaction logs

## 🛡️ Compliance & Security

### 1. PCI DSS Compliance
- No card data storage
- Secure API communication
- Regular security audits

### 2. Data Protection
- GDPR compliance for EU customers
- Data retention policies
- User consent management

### 3. Financial Regulations
- Transaction reporting
- Anti-money laundering (AML) compliance
- Know Your Customer (KYC) requirements

## 🚀 Go-Live Checklist

### Pre-Launch
- [ ] PayPal production app approved
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Domain verification completed
- [ ] Webhook endpoints tested

### Testing
- [ ] End-to-end payment flow tested
- [ ] Error scenarios validated
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Load testing passed

### Monitoring
- [ ] Logging configured
- [ ] Alerts set up
- [ ] Dashboard created
- [ ] Support procedures documented
- [ ] Incident response plan ready

### Documentation
- [ ] API documentation updated
- [ ] User guides created
- [ ] Support team trained
- [ ] Troubleshooting guides prepared

## 📞 Support & Troubleshooting

### 1. PayPal Support
- **Merchant Support**: For account and integration issues
- **Developer Support**: For technical API questions
- **Documentation**: [PayPal Developer Docs](https://developer.paypal.com/docs/)

### 2. Common Issues
- **"Something went wrong"**: Check API payload format
- **Authentication failures**: Verify credentials and environment
- **Webhook failures**: Check endpoint accessibility and SSL

### 3. Debug Tools
- Edge Function logs in Supabase Dashboard
- PayPal transaction logs in Developer Dashboard
- Database transaction records for audit trail

## 🔄 Maintenance & Updates

### 1. Regular Tasks
- Monitor transaction success rates
- Review error logs weekly
- Update dependencies monthly
- Security patches as needed

### 2. PayPal API Updates
- Subscribe to PayPal developer notifications
- Test API changes in sandbox first
- Plan migration for deprecated features

### 3. Performance Reviews
- Monthly performance analysis
- Quarterly security reviews
- Annual compliance audits

---

## 🎯 Quick Start Commands

```bash
# Deploy Edge Function
supabase functions deploy paypal-payment

# Test in sandbox
curl -X POST "https://your-project.supabase.co/functions/v1/paypal-payment" \
  -H "Content-Type: application/json" \
  -d '{"action":"create-order","amount":1.00,"currency":"USD","customerEmail":"test@example.com"}'

# Check transaction logs
psql -c "SELECT * FROM paypal_transactions ORDER BY created_at DESC LIMIT 10;"
```

This production-ready setup ensures secure, reliable, and scalable PayPal payment processing for your application.