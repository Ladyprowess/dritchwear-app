import { useEffect, useState } from 'react';
import type { Profile } from '@/lib/auth';

interface UseDeliveryAddressArgs {
  profile: Profile | null;
  showCheckoutNotice: (title: string, message: string) => void;
}

export function useDeliveryAddress({ profile, showCheckoutNotice }: UseDeliveryAddressArgs) {
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [contactPhone, setContactPhone] = useState(profile?.phone || '');
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [addressPromptHandled, setAddressPromptHandled] = useState(false);

  const defaultAddress = (profile?.location || '').trim();

  const handleUseDefaultAddress = () => {
    setDeliveryAddress(defaultAddress);

    const parts = defaultAddress.split(',').map(p => p.trim()).filter(Boolean);

    // last two parts become state + country (simple rule)
    const maybeCountry = parts[parts.length - 1] || '';
    const maybeState = parts[parts.length - 2] || '';

    setDeliveryState(maybeState);
    setDeliveryCountry(maybeCountry);

    setShowAddressPrompt(false);
    setAddressPromptHandled(true);
  };

  const handleChangeAddress = () => {
    setDeliveryAddress('');
    setDeliveryState('');
    setDeliveryCountry('');
    setShowAddressPrompt(false);
    setAddressPromptHandled(true);
  };

  useEffect(() => {
    // Wait until profile loads
    if (!profile) return;

    // If prompt already handled, don't show again
    if (addressPromptHandled) return;

    // If user has a saved address, ask what to do
    if (defaultAddress.length > 0) {
      setShowAddressPrompt(true);
      return;
    }

    showCheckoutNotice(
      'Add Delivery Address',
      'No saved address was found on your profile. Please enter your delivery address below before payment.'
    );

    setAddressPromptHandled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, defaultAddress, addressPromptHandled]);

  return {
    deliveryAddress,
    setDeliveryAddress,
    deliveryState,
    setDeliveryState,
    deliveryCountry,
    setDeliveryCountry,
    contactPhone,
    setContactPhone,
    showAddressPrompt,
    setShowAddressPrompt,
    defaultAddress,
    handleUseDefaultAddress,
    handleChangeAddress,
  };
}
