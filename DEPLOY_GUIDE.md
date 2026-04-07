# Direct Deployment Guide (Vercel CLI)

If you do not want to connect your GitHub repository to Vercel, you can deploy the frontend directly from your local machine using the **Vercel CLI**.

## 1. Install Vercel CLI

Open your terminal and install the Vercel CLI globally:

```bash
npm i -g vercel
```

## 2. Login to Vercel

Authenticate your CLI with your Vercel account:

```bash
vercel login
```

## 3. Deploy the Project

Navigate to the `frontend` directory and run the deployment command:

```bash
cd frontend
vercel
```

Follow the prompts:
1. **Set up and deploy?** Yes
2. **Which scope?** (Select your account)
3. **Link to existing project?** No (if this is the first time)
4. **What's your project's name?** `solana-yield-vault`
5. **In which directory is your code located?** `./` (Press Enter)
6. **Want to modify settings?** Yes

### 4. Configure Environment Variables

When prompted to modify settings, you MUST add the environment variables defined in `.env.example`:

- `NEXT_PUBLIC_SOLANA_RPC_URL`: (Your RPC URL)
- `NEXT_PUBLIC_PROGRAM_ID`: `EA6Sz3Q7CuoyJSzmDD3QUf5KXRrqHZ4QbxkmyrZfUNBi`
- `NEXT_PUBLIC_ADMIN_WALLET_ADDRESS`: `3mCLdsLhyRN3VAqvPteAzk8mJngwdmUbUf8YEGicxT8c`

Alternatively, you can add them after the first deployment in the [Vercel Dashboard](https://vercel.com/dashboard).

## 5. Production Deployment

Once the "preview" deployment is successful, push it to production:

```bash
vercel --prod
```

## Troubleshooting

- **Build Errors**: Ensure you have run `npm install` and `npm run build` locally first to verify there are no code issues.
- **Missing Env Vars**: If the app loads but can't connect to the vault, double-check that your `NEXT_PUBLIC_` variables are correctly set in the Vercel project settings.
