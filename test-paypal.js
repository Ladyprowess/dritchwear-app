// Test script for PayPal Edge Function
require('dotenv').config();

// Get environment variables with fallbacks
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Environment Check:');
console.log('SUPABASE_URL:', SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : '❌ NOT SET');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.log('Please ensure you have a .env file with:');
  console.log('EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

async function testPayPalFunction() {
  console.log('\n🧪 Testing PayPal Edge Function...');
  
  const testPayload = {
    action: 'create-order',
    amount: 1.00,
    currency: 'USD',
    customerEmail: 'test@example.com',
    customerName: 'Test Customer',
    description: 'Test Payment',
    userId: 'test-user-123'
  };

  console.log('📤 Sending test payload:', JSON.stringify(testPayload, null, 2));

  try {
    const url = `${SUPABASE_URL}/functions/v1/paypal-payment`;
    console.log('🌐 Request URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('\n📊 Response Status:', response.status, response.statusText);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📊 Raw Response:', responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ Test successful!');
        console.log('🎯 Order ID:', data.orderId);
        console.log('🔗 Approval URL:', data.approvalUrl ? `${data.approvalUrl.substring(0, 50)}...` : 'Not provided');
        console.log('📋 Request ID:', data.requestId);
        
        if (data.approvalUrl) {
          console.log('\n🎉 PayPal integration is working correctly!');
          console.log('💡 You can now test payments in your app.');
        }
      } catch (parseError) {
        console.error('❌ Failed to parse successful response:', parseError);
      }
    } else {
      console.error('\n❌ Test failed with status:', response.status);
      try {
        const errorData = JSON.parse(responseText);
        console.error('❌ Error details:', errorData);
        
        if (errorData.error?.includes('credentials not configured')) {
          console.log('\n💡 Fix: Set PayPal environment variables in Supabase:');
          console.log('   PAYPAL_CLIENT_ID=your_paypal_client_id');
          console.log('   PAYPAL_CLIENT_SECRET=your_paypal_client_secret');
          console.log('   PAYPAL_ENVIRONMENT=sandbox');
        }
      } catch {
        console.error('❌ Raw error response:', responseText);
      }
    }

  } catch (error) {
    console.error('\n💥 Test error:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 This might be a network connectivity issue.');
      console.log('   - Check your internet connection');
      console.log('   - Verify the Supabase URL is correct');
      console.log('   - Ensure the Edge Function is deployed');
    }
  }
}

async function testEdgeFunctionDeployment() {
  console.log('\n🔍 Testing Edge Function deployment...');
  
  try {
    const url = `${SUPABASE_URL}/functions/v1/paypal-payment`;
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    console.log('📊 OPTIONS Response:', response.status);
    
    if (response.ok) {
      console.log('✅ Edge Function is deployed and accessible');
    } else {
      console.log('❌ Edge Function might not be deployed');
      console.log('💡 Run: supabase functions deploy paypal-payment');
    }
  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
  }
}

// Run the tests
async function runAllTests() {
  await testEdgeFunctionDeployment();
  await testPayPalFunction();
}

runAllTests();