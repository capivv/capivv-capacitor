# Capivv Capacitor Example

This example app demonstrates how to integrate the `@capivv/capacitor-sdk` into an Ionic/Capacitor application.

## Features Demonstrated

- SDK initialization
- User identification
- Entitlement checking
- Paywall presentation
- Purchase restoration

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

```bash
# Install dependencies
npm install

# Build the web app
npm run build

# Sync with native platforms
npx cap sync
```

### Running the App

**Web (Development):**
```bash
npm run start
```

**iOS:**
```bash
npx cap open ios
# Then run from Xcode
```

**Android:**
```bash
npx cap open android
# Then run from Android Studio
```

### Configuration

Update the API key in `src/App.tsx`:

```typescript
await Capivv.configure({
  apiKey: 'capivv_pk_YOUR_API_KEY',
  debug: true, // Set to false in production
});
```

## Usage Examples

### Initialize SDK

```typescript
import { Capivv } from '@capivv/capacitor-sdk';

await Capivv.configure({
  apiKey: 'capivv_pk_YOUR_API_KEY',
  debug: true,
});
```

### Identify User

```typescript
await Capivv.identify({
  userId: 'user-123',
  attributes: {
    email: 'user@example.com',
    name: 'John Doe',
  },
});
```

### Check Entitlements

```typescript
const result = await Capivv.checkEntitlement({
  entitlementIdentifier: 'premium',
});

if (result.hasAccess) {
  // Show premium content
} else {
  // Show paywall
}
```

### Sync Purchases

```typescript
await Capivv.syncPurchases();
```

### Restore Purchases

```typescript
await Capivv.restorePurchases();
```

## Project Structure

```
example/
├── src/
│   ├── App.tsx              # Main example component
│   ├── main.tsx             # Entry point
│   └── theme/
│       └── variables.css    # Ionic theme variables
├── index.html
├── package.json
├── capacitor.config.ts      # Capacitor configuration
├── tsconfig.json
└── vite.config.ts
```

## Using with Ionic Angular

If you're using Angular instead of React:

```typescript
// app.module.ts
import { CapivvModule } from '@capivv/capacitor-sdk/components/angular';

@NgModule({
  imports: [CapivvModule]
})
export class AppModule {}

// In your component template
<capivv-paywall
  [title]="'Unlock Premium'"
  [features]="['Feature 1', 'Feature 2']"
  (purchaseComplete)="onPurchase($event)"
  (dismiss)="closePaywall()">
</capivv-paywall>
```

## Using with Ionic Vue

```vue
<template>
  <capivv-paywall
    title="Unlock Premium"
    :features="['Feature 1', 'Feature 2']"
    @purchase-complete="onPurchase"
    @dismiss="closePaywall"
  />
</template>

<script setup>
import { CapivvPaywall } from '@capivv/capacitor-sdk/components/vue';
</script>
```

## Testing

For testing in-app purchases:

- **iOS**: Use Sandbox test accounts
- **Android**: Use Google Play test tracks with license testers

## Troubleshooting

### Plugin not loading

Ensure you've run `npx cap sync` after installing the package.

### Purchase flow not working

1. Check that the API key is correct
2. Ensure the user is identified before attempting purchases
3. On iOS, verify In-App Purchase capability is enabled in Xcode
4. On Android, ensure the app is signed and uploaded to Play Console
