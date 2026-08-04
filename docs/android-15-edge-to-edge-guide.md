# Android 15 Edge-to-Edge Display Guide

## 🚀 Overview

Starting with Android 15, apps targeting SDK 35 will display edge-to-edge by default. This guide covers the implementation of proper edge-to-edge support in the Dritchwear app.

## 📱 What is Edge-to-Edge?

Edge-to-edge display means your app content extends behind the system bars (status bar and navigation bar), creating a more immersive experience. However, this requires careful handling of system insets to ensure content isn't hidden behind system UI.

## ⚙️ Implementation

### 1. App Configuration

**app.config.js:**
```javascript
export default {
  android: {
    compileSdkVersion: 35,
    targetSdkVersion: 35,
    minSdkVersion: 21,
    enableEdgeToEdge: true, // Enable edge-to-edge
  },
  androidStatusBar: {
    barStyle: 'dark-content',
    backgroundColor: 'transparent',
    translucent: true,
  },
  androidNavigationBar: {
    visible: 'leanback',
    barStyle: 'dark-content',
    backgroundColor: 'transparent',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          enableEdgeToEdge: true,
        },
      },
    ],
  ],
};
```

### 2. Safe Area Handling

**useEdgeToEdge Hook:**
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useEdgeToEdge() {
  const insets = useSafeAreaInsets();
  
  return {
    insets,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
}
```

### 3. EdgeToEdgeWrapper Component

**Automatic Inset Handling:**
```typescript
<EdgeToEdgeWrapper backgroundColor="#F9FAFB" edges={['top', 'bottom']}>
  <YourScreenContent />
</EdgeToEdgeWrapper>
```

## 🎯 Key Features

### ✅ **Automatic Detection**
- Detects Android 15+ devices
- Falls back to SafeAreaView on older versions
- Maintains compatibility across all Android versions

### ✅ **Flexible Configuration**
- Choose which edges to handle
- Custom background colors
- Optional status bar styling

### ✅ **Performance Optimized**
- Minimal overhead
- Efficient inset calculations
- Smooth transitions

## 📋 Implementation Checklist

### Configuration
- [ ] Update `app.config.js` with SDK 35 target
- [ ] Add `expo-build-properties` plugin
- [ ] Configure transparent system bars
- [ ] Enable edge-to-edge in build properties

### Code Updates
- [ ] Wrap root layout with `SafeAreaProvider`
- [ ] Update screens to use `EdgeToEdgeWrapper`
- [ ] Handle insets in custom components
- [ ] Test on Android 15+ devices

### Testing
- [ ] Test on Android 15+ emulator
- [ ] Verify content isn't hidden behind system bars
- [ ] Check landscape orientation
- [ ] Test with different screen sizes
- [ ] Verify backward compatibility

## 🔧 Common Issues & Solutions

### Issue: Content Hidden Behind Status Bar
**Solution:** Use proper top inset padding
```typescript
const { insets } = useEdgeToEdge();
<View style={{ paddingTop: insets.top }}>
```

### Issue: Navigation Bar Overlap
**Solution:** Use bottom inset padding
```typescript
<View style={{ paddingBottom: insets.bottom }}>
```

### Issue: Inconsistent Behavior
**Solution:** Use EdgeToEdgeWrapper consistently
```typescript
<EdgeToEdgeWrapper edges={['top', 'bottom', 'left', 'right']}>
```

## 🎨 Design Considerations

### Visual Hierarchy
- Ensure important content is within safe areas
- Use insets for proper spacing
- Consider gesture areas on modern devices

### Status Bar Styling
- Use appropriate contrast for readability
- Consider dark/light content based on background
- Test with different system themes

### Navigation
- Account for gesture navigation areas
- Ensure tap targets are accessible
- Provide adequate spacing from edges

## 🚀 Benefits

### User Experience
- **Immersive Display** - Full screen utilization
- **Modern Look** - Follows Android 15 design guidelines
- **Consistent Behavior** - Matches system apps

### Developer Experience
- **Future-Proof** - Ready for Android 15+
- **Backward Compatible** - Works on all Android versions
- **Easy Implementation** - Simple wrapper components

## 📊 Testing Strategy

### Device Testing
1. **Android 15+ Devices** - Primary target
2. **Android 14 and below** - Backward compatibility
3. **Different Screen Sizes** - Phones, tablets, foldables
4. **Orientation Changes** - Portrait and landscape

### Automated Testing
- Unit tests for inset calculations
- Integration tests for component behavior
- Visual regression tests for UI consistency

## 🔄 Migration Path

### Phase 1: Core Implementation
- Update app configuration
- Add edge-to-edge wrapper
- Update main screens

### Phase 2: Component Updates
- Update all custom components
- Handle modal and overlay insets
- Test thoroughly

### Phase 3: Optimization
- Performance improvements
- Visual polish
- User feedback integration

This implementation ensures your app is ready for Android 15 while maintaining compatibility with older versions! 🎉