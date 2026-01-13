# Database Analysis Scripts

## analyze-unlabeled-invoices.js

Analyzes Stripe invoices to identify unlabeled transactions and what data is available.

### Setup

1. Download Firebase service account key:
   - Go to: https://console.firebase.google.com/project/opsos-864a1/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json` in the `app/` directory

2. Install dependencies (if not already):
   ```bash
   npm install firebase-admin
   ```

### Usage

```bash
cd app
node scripts/analyze-unlabeled-invoices.js
```

### Output

- Total invoices count
- Count with/without product IDs
- Sample unlabeled invoices with all available fields
- Percentage of unlabeled transactions
