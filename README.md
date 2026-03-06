# @capivv/capacitor-sdk

Official Capacitor plugin for [Capivv](https://capivv.com) - Revenue as Code for subscription management.

This plugin provides in-app purchase and subscription management for Ionic/Capacitor apps, with native support for iOS (StoreKit 2) and Android (Google Play Billing).

## Installation

```bash
npm install @capivv/capacitor-sdk
npx cap sync
```

## Platform Requirements

- **iOS**: iOS 15.0+ (StoreKit 2)
- **Android**: API 24+ (Google Play Billing Library 6.x)
- **Web**: Requires Stripe integration (coming soon)

## Configuration

### iOS Setup

Add in-app purchase capability in Xcode:

1. Open your app in Xcode
2. Select your target → "Signing & Capabilities"
3. Click "+ Capability" and add "In-App Purchase"

### Android Setup

No additional configuration required. The plugin automatically requests the billing permission.

## Usage

### Initialize the SDK

```typescript
import { Capivv } from '@capivv/capacitor-sdk';

// Configure with your API key
await Capivv.configure({
  apiKey: 'capivv_pk_your_public_key',
  debug: true, // Enable for development
});

// Identify the current user
const userInfo = await Capivv.identify({
  userId: 'user_123',
  attributes: {
    email: 'user@example.com',
    name: 'John Doe',
  },
});

console.log('User entitlements:', userInfo.entitlements);
```

### Check Entitlements

```typescript
// Check if user has access to a specific feature
const result = await Capivv.checkEntitlement({
  entitlementIdentifier: 'premium',
});

if (result.hasAccess) {
  // User has premium access
  showPremiumContent();
} else {
  // Show paywall
  showPaywall();
}

// Get all active entitlements
const { entitlements } = await Capivv.getEntitlements();
```

### Get Products and Offerings

```typescript
// Get configured offerings from Capivv dashboard
const { offerings } = await Capivv.getOfferings();

for (const offering of offerings) {
  console.log(`Offering: ${offering.identifier}`);
  for (const product of offering.products) {
    console.log(`  ${product.title}: ${product.priceString}`);
  }
}

// Get a specific product
const { product } = await Capivv.getProduct({
  productIdentifier: 'com.yourapp.premium.monthly',
});
```

### Make a Purchase

```typescript
import { Capivv, ProductType } from '@capivv/capacitor-sdk';

const result = await Capivv.purchase({
  productIdentifier: 'com.yourapp.premium.monthly',
  productType: ProductType.SUBSCRIPTION,
});

if (result.success) {
  console.log('Purchase successful!', result.transaction);
  // Entitlements are automatically updated
} else {
  console.log('Purchase failed:', result.error);
}
```

### Restore Purchases

```typescript
// Restore purchases for users who reinstall or switch devices
const { entitlements } = await Capivv.restorePurchases();
console.log('Restored entitlements:', entitlements);
```

### Listen for Updates

```typescript
// Listen for entitlement changes
const listener = await Capivv.addListener('entitlementsUpdated', (event) => {
  console.log('Entitlements updated:', event.entitlements);
  updateUIForEntitlements(event.entitlements);
});

// Listen for purchase completion
await Capivv.addListener('purchaseCompleted', (event) => {
  console.log('Purchase completed:', event.transaction);
});

// Listen for purchase failures
await Capivv.addListener('purchaseFailed', (event) => {
  console.error('Purchase failed:', event.error);
});

// Remove listener when done
listener.remove();
```

### Subscription Management

```typescript
// Open platform-specific subscription management UI
await Capivv.manageSubscriptions();
// iOS: Opens App Store subscription settings
// Android: Opens Google Play subscription management
```

### Sync Purchases

```typescript
// Sync local purchases with server (call on app launch)
const { entitlements } = await Capivv.syncPurchases();
```

## API Reference

### Configuration

#### `configure(config: CapivvConfig): Promise<void>`

Initialize the SDK with your API key.

| Parameter | Type    | Required | Description                              |
| --------- | ------- | -------- | ---------------------------------------- |
| apiKey    | string  | Yes      | Your Capivv public API key               |
| apiUrl    | string  | No       | API endpoint (defaults to production)    |
| debug     | boolean | No       | Enable debug logging                     |

### User Management

#### `identify(options): Promise<UserInfo>`

Identify the current user. Creates the user in Capivv if they don't exist.

#### `logout(): Promise<void>`

Log out the current user and clear cached data.

#### `getUserInfo(): Promise<UserInfo>`

Get the current user's information including entitlements.

### Products

#### `getOfferings(): Promise<{ offerings: Offering[] }>`

Get available offerings configured in your Capivv dashboard.

#### `getProduct(options): Promise<{ product: Product }>`

Get a specific product by identifier.

#### `getProducts(options): Promise<{ products: Product[] }>`

Get multiple products by identifier.

### Purchases

#### `purchase(options): Promise<PurchaseResult>`

Purchase a product.

#### `restorePurchases(): Promise<{ entitlements: Entitlement[] }>`

Restore previous purchases.

#### `syncPurchases(): Promise<{ entitlements: Entitlement[] }>`

Sync purchases with the server.

#### `manageSubscriptions(): Promise<void>`

Open the platform-specific subscription management UI.

### Entitlements

#### `checkEntitlement(options): Promise<EntitlementCheckResult>`

Check if the user has access to a specific entitlement.

#### `getEntitlements(): Promise<{ entitlements: Entitlement[] }>`

Get all active entitlements for the current user.

### Events

| Event                | Description                                |
| -------------------- | ------------------------------------------ |
| entitlementsUpdated  | Fired when entitlements change             |
| purchaseCompleted    | Fired when a purchase completes            |
| purchaseFailed       | Fired when a purchase fails                |

## Paywall Components

Pre-built paywall components are available as companion packages:

- **React**: `npm install @capivv/capacitor-react`
- **Vue**: `npm install @capivv/capacitor-vue`
- **Angular**: `npm install @capivv/capacitor-angular`

```tsx
// React example
import { CapivvPaywall } from '@capivv/capacitor-react';

<CapivvPaywall
  offeringId="default"
  title="Unlock Premium"
  features={['Unlimited access', 'No ads', 'Priority support']}
  showRestoreButton={true}
  onPurchaseComplete={(result) => console.log('Purchased!', result)}
  onDismiss={() => setShowPaywall(false)}
/>
```

## Integration with Ionic

### Angular

```typescript
import { Component, OnInit } from '@angular/core';
import { Capivv } from '@capivv/capacitor-sdk';

@Component({
  selector: 'app-subscription',
  template: `
    <ion-content>
      <ion-list *ngIf="offerings">
        <ion-item *ngFor="let product of offerings[0]?.products" (click)="purchase(product)">
          <ion-label>
            <h2>{{ product.title }}</h2>
            <p>{{ product.priceString }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class SubscriptionPage implements OnInit {
  offerings: Offering[] = [];

  async ngOnInit() {
    await Capivv.configure({ apiKey: 'your_api_key' });
    await Capivv.identify({ userId: 'user_123' });

    const { offerings } = await Capivv.getOfferings();
    this.offerings = offerings;
  }

  async purchase(product: Product) {
    const result = await Capivv.purchase({
      productIdentifier: product.identifier,
    });

    if (result.success) {
      // Navigate to premium content
    }
  }
}
```

### React

```tsx
import { useEffect, useState } from 'react';
import { Capivv, Offering } from '@capivv/capacitor-sdk';

function SubscriptionPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);

  useEffect(() => {
    async function init() {
      await Capivv.configure({ apiKey: 'your_api_key' });
      await Capivv.identify({ userId: 'user_123' });

      const { offerings } = await Capivv.getOfferings();
      setOfferings(offerings);
    }
    init();
  }, []);

  const handlePurchase = async (productId: string) => {
    const result = await Capivv.purchase({ productIdentifier: productId });
    if (result.success) {
      // Navigate to premium content
    }
  };

  return (
    <IonContent>
      <IonList>
        {offerings[0]?.products.map((product) => (
          <IonItem key={product.identifier} onClick={() => handlePurchase(product.identifier)}>
            <IonLabel>
              <h2>{product.title}</h2>
              <p>{product.priceString}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    </IonContent>
  );
}
```

## Testing

### iOS Sandbox Testing

1. Create sandbox testers in App Store Connect
2. Sign out of your Apple ID on the device
3. Launch your app and attempt a purchase
4. Sign in with the sandbox tester account when prompted

### Android Test Purchases

1. Add license testers in Google Play Console
2. Upload your app to internal testing track
3. Use the license tester accounts to test purchases

## Troubleshooting

### "Not configured" error

Make sure to call `configure()` before any other methods:

```typescript
await Capivv.configure({ apiKey: 'your_api_key' });
```

### "Not identified" error

Make sure to call `identify()` after configuration:

```typescript
await Capivv.identify({ userId: 'user_123' });
```

### Products not loading

- Verify products are configured in App Store Connect / Google Play Console
- Ensure product IDs match exactly (case-sensitive)
- For iOS, make sure paid agreements are signed in App Store Connect
- For Android, ensure the app is uploaded to at least internal testing

## License

MIT

## Support

- Documentation: https://docs.capivv.com
- Issues: https://github.com/capivv/capivv/issues
