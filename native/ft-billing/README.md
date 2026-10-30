# FtBilling

Native Capacitor 7 Android bridge for Google Play subscriptions and Play Integrity.

Methods:
- `deviceInfo()`
- `getProducts({ productIds })`
- `purchase({ productId, offerToken })`
- `queryPurchases()`
- `integrityToken({ nonce, cloudProjectNumber })`
- `manageSubscriptions({ productId? })`

Event: `purchasesUpdated`.

The client never acknowledges or consumes purchases.
The client never unlocks content or decides entitlement; the server does.
