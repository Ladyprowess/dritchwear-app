import { Redirect } from 'expo-router';

// app.dritchwear.com is the ordering application. The catalogue is its home.
export default function OrderAppEntry() {
  return <Redirect href="/(customer)/shop" />;
}
