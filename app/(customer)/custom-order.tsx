import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, DollarSign, FileText, Building, Calendar, MapPin, Upload, Palette, Target } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { usePostHog } from 'posthog-react-native';
// DateTimePicker and FileSystem are loaded lazily (not available on web)


const BRAND_PURPLE = '#5A2D82';
const BRAND_GOLD = '#FDB813';


// Budget ranges in different currencies
const budgetRanges = {
  NGN: [
    '₦10,000 - ₦25,000',
    '₦25,000 - ₦50,000',
    '₦50,000 - ₦100,000',
    '₦100,000 - ₦200,000',
    '₦200,000+',
  ],
  USD: [
    '$25 - $60',
    '$60 - $125',
    '$125 - $250',
    '$250 - $500',
    '$500+',
  ],
  EUR: [
    '€20 - €50',
    '€50 - €100',
    '€100 - €200',
    '€200 - €400',
    '€400+',
  ],
  GBP: [
    '£20 - £45',
    '£45 - £90',
    '£90 - £180',
    '£180 - £360',
    '£360+',
  ],
  CAD: [
    'C$30 - C$75',
    'C$75 - C$150',
    'C$150 - C$300',
    'C$300 - C$600',
    'C$600+',
  ],
  AUD: [
    'A$35 - A$85',
    'A$85 - A$170',
    'A$170 - A$340',
    'A$340 - A$680',
    'A$680+',
  ],
  JPY: [
    '¥3,000 - ¥7,500',
    '¥7,500 - ¥15,000',
    '¥15,000 - ¥30,000',
    '¥30,000 - ¥60,000',
    '¥60,000+',
  ],
  CHF: [
    'CHF 25 - CHF 60',
    'CHF 60 - CHF 120',
    'CHF 120 - CHF 240',
    'CHF 240 - CHF 480',
    'CHF 480+',
  ],
  CNY: [
    '¥150 - ¥375',
    '¥375 - ¥750',
    '¥750 - ¥1,500',
    '¥1,500 - ¥3,000',
    '¥3,000+',
  ],
  INR: [
    '₹2,000 - ₹5,000',
    '₹5,000 - ₹10,000',
    '₹10,000 - ₹20,000',
    '₹20,000 - ₹40,000',
    '₹40,000+',
  ],
  ZAR: [
    'R400 - R1,000',
    'R1,000 - R2,000',
    'R2,000 - R4,000',
    'R4,000 - R8,000',
    'R8,000+',
  ],
  KES: [
    'KSh 3,000 - KSh 7,500',
    'KSh 7,500 - KSh 15,000',
    'KSh 15,000 - KSh 30,000',
    'KSh 30,000 - KSh 60,000',
    'KSh 60,000+',
  ],
  GHS: [
    '₵300 - ₵750',
    '₵750 - ₵1,500',
    '₵1,500 - ₵3,000',
    '₵3,000 - ₵6,000',
    '₵6,000+',
  ],
};

export default function CustomOrderScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const posthog = usePostHog();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quantity: '1',
    budgetRange: '',
    businessName: '',
    eventName: '',
    logoUrl: '',
    brandColors: '',
    logoPlacement: 'Chest (Center)',
    deliveryAddress: profile?.location || '',
    deadline: '',
    additionalNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);


  // Get user's preferred currency or default to NGN
  const userCurrency = profile?.preferred_currency || 'NGN';
  const availableBudgetRanges = budgetRanges[userCurrency as keyof typeof budgetRanges] || budgetRanges.NGN;

  const logoPlacementOptions = [
    'Chest (Left)',
    'Chest (Center)',
    'Chest (Right)',
    'Back (Full)',
    'Back (Upper)',
    'Back (Lower)',
    'Sleeve (Left)',
    'Sleeve (Right)',
    'Sleeve (Both)',
    'Custom Placement'
  ];

  // Generate unique filename using crypto
  const generateUniqueFilename = async (extension) => {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Date.now().toString() + Math.random().toString()
      );
      return `logo_${hash.slice(0, 16)}.${extension}`;
    } catch (error) {
      // Fallback if crypto fails
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000);
      return `logo_${timestamp}_${random}.${extension}`;
    }
  };

  const handleImagePicker = async () => {
    try {
      setUploadingLogo(true);

      // Launch image picker with updated syntax
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setUploadingLogo(false);
        return;
      }

      const asset = result.assets[0];
      
      // Validate file size and type
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image under 5MB.');
        setUploadingLogo(false);
        return;
      }

      if (asset.mimeType && !['image/jpeg', 'image/png', 'image/jpg'].includes(asset.mimeType)) {
        Alert.alert('Invalid Format', 'Only JPG or PNG images are allowed.');
        setUploadingLogo(false);
        return;
      }

      // Generate unique filename
      const fileExtension = asset.mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = await generateUniqueFilename(fileExtension);
      const filePath = `logos/${fileName}`;

      console.log('Uploading file:', { fileName, filePath, mimeType: asset.mimeType });

      // Convert image to base64 for upload
      let base64: string;
      if (Platform.OS === 'web') {
        // On web, expo-image-picker returns a blob: or data: URI - fetch it and
        // convert to base64 using FileReader (works in all browsers incl. Safari)
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]); // strip "data:...;base64," prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Native path - lazy-load so expo-file-system never touches the web bundle
        const FileSystem = await import('expo-file-system/legacy');
        base64 = await (FileSystem as any).readAsStringAsync(asset.uri, {
          encoding: (FileSystem as any).EncodingType.Base64,
        });
      }

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('custom-order-assets')
        .upload(filePath, decode(base64), {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: false,
        });

      if (error || !data) {
        console.error('Upload failed:', error);
        throw new Error(error?.message || 'Upload failed');
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
  .from('custom-order-assets')
  .getPublicUrl(data.path);

if (!publicUrlData?.publicUrl) {
  throw new Error('Failed to get public URL');
}


      console.log('Public URL generated:', publicUrlData.publicUrl);

      // Update form data with the new logo URL
      setFormData(prev => ({ ...prev, logoUrl: publicUrlData.publicUrl }));
      console.log('Final logo URL:', publicUrlData.publicUrl);

      Alert.alert('Success', 'Logo uploaded successfully!');

    } catch (error) {
      console.error('Image upload error:', error);
      
      let errorMessage = 'There was a problem uploading your logo. Please try again.';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('storage') || error.message?.includes('bucket')) {
        errorMessage = 'Storage service unavailable. Please try again later.';
      } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
        errorMessage = 'Upload permission denied. Please contact support.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Helper function to decode base64 (you might need to implement this)
  const decode = (base64String) => {
    // Convert base64 string to Uint8Array for Supabase upload
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const getSupabaseErrorMessage = (error: any) => {
    if (!error) return 'Something went wrong. Please try again.';

    const message =
      error?.message ||
      error?.error_description ||
      String(error);

    if (message.includes('row-level security')) {
      return 'Permission denied. Please log in again or contact support.';
    }
    if (message.includes('violates foreign key constraint')) {
      return 'Your account profile is not ready yet. Please log out and log in again.';
    }
    if (message.includes('duplicate key value')) {
      return 'This request already exists.';
    }
    if (message.includes('invalid input syntax for type uuid')) {
      return 'Your login session is invalid. Please log in again.';
    }
    if (message.toLowerCase().includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }



    return message;
  };


  const handleSubmit = async () => {
    try {
      if (
        !formData.title.trim() ||
        !formData.description.trim() ||
        !formData.budgetRange ||
        !formData.deliveryAddress.trim()
      ) {
        Alert.alert('Missing Information', 'Please fill in all required fields.');
        return;
      }

      const qty = Number.parseInt(formData.quantity, 10);
      if (Number.isNaN(qty) || qty <= 0) {
        Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
        return;
      }

      let deadlineISO: string | null = null;

      if (deadlineDate) {
        if (deadlineDate <= new Date()) {
          Alert.alert('Invalid Deadline', 'Deadline must be in the future.');
          return;
        }
        deadlineISO = deadlineDate.toISOString();
      } else if (formData.deadline.trim()) {
        // fallback (in case old data exists)
        const d = new Date(formData.deadline);
        if (Number.isNaN(d.getTime())) {
          Alert.alert('Invalid Deadline', 'Please select a valid date.');
          return;
        }
        if (d <= new Date()) {
          Alert.alert('Invalid Deadline', 'Deadline must be in the future.');
          return;
        }
        deadlineISO = d.toISOString();
      }
      


      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in.');
        return;
      }

      setLoading(true);

      const payload = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        quantity: qty,
        budget_range: formData.budgetRange,
        status: 'pending',
        currency: userCurrency,
        invoice_sent: false,

        business_name: formData.businessName.trim() || null,
        event_name: formData.eventName.trim() || null,
        logo_url: formData.logoUrl || null,
        brand_colors: formData.brandColors
          ? formData.brandColors.split(',').map(c => c.trim()).filter(Boolean)
          : null,
        logo_placement: formData.logoPlacement || null,
        delivery_address: formData.deliveryAddress.trim(),
        deadline: deadlineISO,
        additional_notes: formData.additionalNotes.trim() || null,
      };

      console.log('📦 Submitting custom request:', payload);

      const { error } = await supabase
        .from('custom_requests')
        .insert(payload);

      if (error) {
        console.log('❌ Supabase error:', error);
        Alert.alert('Submit Failed', getSupabaseErrorMessage(error));
        return;
      }

      posthog.capture('custom_order_submitted', {
        budget_range: formData.budgetRange,
        quantity: qty,
        currency: userCurrency,
        has_logo: !!formData.logoUrl,
      });
      Alert.alert(
        'Request Submitted',
        'Your custom order request has been submitted successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      console.log('💥 Crash:', err);
      Alert.alert('Error', getSupabaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const formatDateYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={BRAND_PURPLE} />
        </Pressable>
        <Text style={styles.headerTitle}>Custom Order</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
        <Image
  source={require('@/assets/images/shop.png')}
  style={styles.heroIcon}
/>
  <Text style={styles.heroTitle}>Create Your Dream Design</Text>
          <Text style={styles.heroSubtitle}>
            Tell us about your vision and we'll bring it to life with our premium craftsmanship
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Project Title *</Text>
            <View style={styles.inputContainer}>
              <FileText size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="e.g., Custom Hoodie Design"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description *</Text>
            <TextInput
              style={styles.textArea}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe your custom order in detail. Include colors, materials, sizes, design elements, and any specific requirements..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.formHint}>
              Be as detailed as possible to help us understand your vision
            </Text>
          </View>

          {/* Quantity */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Quantity</Text>
            <View style={styles.inputContainer}>
              <Package size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={formData.quantity}
                onChangeText={(text) => setFormData(prev => ({ ...prev, quantity: text }))}
                placeholder="1"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Budget Range */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Budget Range ({userCurrency}) *</Text>
            <Text style={styles.currencyNote}>
              Prices shown in your preferred currency: {userCurrency}
            </Text>
            <View style={styles.budgetGrid}>
              {availableBudgetRanges.map((range) => (
                <Pressable
                  key={range}
                  style={[
                    styles.budgetOption,
                    formData.budgetRange === range && styles.budgetOptionActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, budgetRange: range }))}
                >
                  <DollarSign 
                    size={16} 
                    color={formData.budgetRange === range ? '#FFFFFF' : BRAND_PURPLE} 
                  />
                  <Text
                    style={[
                      styles.budgetText,
                      formData.budgetRange === range && styles.budgetTextActive
                    ]}
                  >
                    {range}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Business/Event Information */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Business/Event Information</Text>
            
            <View style={styles.subFormGroup}>
              <Text style={styles.subLabel}>Business Name</Text>
              <View style={styles.inputContainer}>
                <Building size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  value={formData.businessName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, businessName: text }))}
                  placeholder="e.g., Acme Corporation"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.subFormGroup}>
              <Text style={styles.subLabel}>Event Name</Text>
              <View style={styles.inputContainer}>
                <Calendar size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  value={formData.eventName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, eventName: text }))}
                  placeholder="e.g., Annual Conference 2024"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          {/* Logo Upload */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Logo Upload</Text>
            <Pressable 
              style={styles.logoUploadContainer}
              onPress={handleImagePicker}
              disabled={uploadingLogo}
            >
              {formData.logoUrl ? (
                <View style={styles.logoPreview}>
                  <Image 
                    source={{ uri: formData.logoUrl }} 
                    style={styles.logoImage} 
                    resizeMode="contain"
                    onError={(error) => {
                      console.log('Image load error:', error);
                      // Reset logo URL if image fails to load
                      setFormData(prev => ({ ...prev, logoUrl: '' }));
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', formData.logoUrl);
                    }}
                  />
                  <Text style={styles.logoUploadText}>Tap to change logo</Text>
                </View>
              ) : (
                <View style={styles.logoUploadPlaceholder}>
                  <Upload size={32} color="#9CA3AF" />
                  <Text style={styles.logoUploadText}>
                    {uploadingLogo ? 'Uploading...' : 'Tap to upload logo'}
                  </Text>
                  <Text style={styles.logoUploadHint}>
                    PNG, JPG up to 5MB
                  </Text>
                </View>
              )}

            </Pressable>
          </View>

          {/* Brand Colors */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Brand Colors</Text>
            <View style={styles.inputContainer}>
              <Palette size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={formData.brandColors}
                onChangeText={(text) => setFormData(prev => ({ ...prev, brandColors: text }))}
                placeholder="e.g., Navy Blue, Gold, White"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={styles.formHint}>
              Separate colors with commas
            </Text>
          </View>

          {/* Logo Placement */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Logo Placement</Text>
            <View style={styles.placementGrid}>
              {logoPlacementOptions.map((placement) => (
                <Pressable
                  key={placement}
                  style={[
                    styles.placementOption,
                    formData.logoPlacement === placement && styles.placementOptionActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, logoPlacement: placement }))}
                >
                  <Target 
                    size={16} 
                    color={formData.logoPlacement === placement ? '#FFFFFF' : BRAND_PURPLE} 
                  />
                  <Text
                    style={[
                      styles.placementText,
                      formData.logoPlacement === placement && styles.placementTextActive
                    ]}
                  >
                    {placement}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Delivery Address */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Delivery Address *</Text>
            <View style={styles.inputContainer}>
              <MapPin size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={formData.deliveryAddress}
                onChangeText={(text) => setFormData(prev => ({ ...prev, deliveryAddress: text }))}
                placeholder="Enter delivery address"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Deadline */}
          {/* Deadline */}
<View style={styles.formGroup}>
  <Text style={styles.formLabel}>Deadline</Text>

  <Pressable
    style={styles.inputContainer}
    onPress={() => setShowDeadlinePicker(true)}
  >
    <Calendar size={20} color="#9CA3AF" />
    <Text
  style={[
    styles.fakeInputText,
    { color: formData.deadline ? '#1F2937' : '#9CA3AF' },
  ]}
>
  {formData.deadline ? formData.deadline : 'Select a date'}
</Text>

  </Pressable>

  <Text style={styles.formHint}>
    When do you need this completed? (Optional)
  </Text>

  {showDeadlinePicker && Platform.OS === 'web' && (
    // Web: native HTML date input - works across Chrome, Firefox, Safari, Edge
    // @ts-ignore - <input> is valid via react-native-web
    <input
      type="date"
      min={formatDateYYYYMMDD(new Date(Date.now() + 24 * 60 * 60 * 1000))}
      value={formData.deadline || ''}
      onChange={(e) => {
        const val = e.target.value;
        if (!val) return;
        const selected = new Date(val + 'T00:00:00');
        setDeadlineDate(selected);
        setFormData(prev => ({ ...prev, deadline: val }));
        setShowDeadlinePicker(false);
      }}
      style={{
        marginTop: 8,
        padding: '10px 14px',
        fontSize: 15,
        borderRadius: 10,
        border: '1px solid #E5E7EB',
        width: '100%',
        fontFamily: 'Inter-Regular',
        color: '#111827',
        outline: 'none',
      } as any}
      autoFocus
    />
  )}

  {showDeadlinePicker && Platform.OS !== 'web' && (() => {
    // Native: lazy-require so the module is never bundled for web
    const DateTimePicker = require('@react-native-community/datetimepicker').default;
    return (
      <DateTimePicker
        value={deadlineDate || new Date(Date.now() + 24 * 60 * 60 * 1000)}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
        onChange={(event: any, selected: Date | undefined) => {
          if (Platform.OS !== 'ios') setShowDeadlinePicker(false);
          if (!selected) return;
          setDeadlineDate(selected);
          setFormData(prev => ({ ...prev, deadline: formatDateYYYYMMDD(selected) }));
        }}
      />
    );
  })()}

  {/* iOS only: done button because the spinner stays open */}
  {Platform.OS === 'ios' && showDeadlinePicker && (
    <Pressable
      style={{ marginTop: 10, alignSelf: 'flex-end' }}
      onPress={() => setShowDeadlinePicker(false)}
    >
      <Text style={{ color: BRAND_PURPLE, fontFamily: 'Inter-SemiBold', fontSize: 14 }}>
        Done
      </Text>
    </Pressable>
  )}
</View>


          {/* Additional Notes */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Additional Notes</Text>
            <TextInput
              style={styles.textArea}
              value={formData.additionalNotes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, additionalNotes: text }))}
              placeholder="Any additional requirements, special instructions, or notes..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Process Info */}
          <View style={styles.processCard}>
            <Text style={styles.processTitle}>How it works:</Text>
            <View style={styles.processSteps}>
              <View style={styles.processStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Submit your request with details</Text>
              </View>
              <View style={styles.processStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>Our team reviews and creates a quote in your currency</Text>
              </View>
              <View style={styles.processStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Approve the quote and we start production</Text>
              </View>
              <View style={styles.processStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <Text style={styles.stepText}>Receive your custom-made item</Text>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
  onPress={handleSubmit}
  disabled={loading}
>
<View style={styles.submitIconCircle}>
  <Image
    source={require('@/assets/images/shop.png')}
    style={styles.submitIcon}
  />
</View>
  <Text style={styles.submitButtonText}>
    {loading ? 'Submitting...' : 'Submit Custom Request'}
  </Text>
</Pressable>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subFormGroup: {
    marginBottom: 16,
    width: '100%',
  },
  subLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  currencyNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: BRAND_PURPLE,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginLeft: 12,
    paddingVertical: 0,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
  },
  formHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 6,
  },
  logoUploadContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  logoUploadPlaceholder: {
    alignItems: 'center',
  },
  logoPreview: {
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoUploadText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginTop: 8,
  },
  logoUploadHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  placementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fakeInputText: {
    flex: 1,
    height: 56,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginLeft: 12,
    textAlignVertical: 'center',
    paddingVertical: 16,
  },
  
  placementOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '45%',
  },
  placementOptionActive: {
    backgroundColor: BRAND_PURPLE,
    borderColor: BRAND_PURPLE,
  },
  placementText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    marginLeft: 8,
  },
  placementTextActive: {
    color: '#FFFFFF',
  },
  budgetGrid: {
    gap: 12,
  },
  budgetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  budgetOptionActive: {
    backgroundColor: BRAND_PURPLE,
    borderColor: BRAND_PURPLE,
  },
  budgetText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    marginLeft: 12,
  },
  budgetTextActive: {
    color: '#FFFFFF',
  },
  processCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginTop: 24,
  },
  processTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  processSteps: {
    gap: 16,
  },
  processStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop:20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    zIndex: 1,
  },
  heroIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  
  submitIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  submitIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 4,
    textAlign: 'center',
  },
});
