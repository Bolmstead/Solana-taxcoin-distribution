# Solana Token Distribution Bot

This Node.js application automatically distributes Solana meme tokens to all token holders every 5 minutes.

## Project Structure

```
src/
├── config/
│   └── solana.js         # Solana connection and wallet configuration
├── helpers/
│   ├── tokenHolders.js   # Functions for fetching token holders
│   └── tokenDistribution.js # Token distribution logic
└── index.js              # Main application entry point
```

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure your environment variables by creating a `.env` file with the following variables:

```
SOLANA_NETWORK=mainnet-beta
MAIN_WALLET_PRIVATE_KEY=your_private_key_here
TOKEN_MINT_ADDRESS=your_token_mint_address_here
DISTRIBUTION_AMOUNT=1000

# Optional RPC URLs (will use these if provided)
HELIUS_RPC_URL=your_helius_mainnet_url
HELIUS_DEV_NET_RPC_URL=your_helius_devnet_url
QUICKNODE_RPC_URL=your_quicknode_url
```

Note: The private key should be in the format of comma-separated numbers (e.g., "183,12,39...").

## Usage

Run the distribution bot:

```bash
pnpm start
```

The bot will:

1. Start immediately with an initial distribution
2. Continue running every 5 minutes
3. Log all transactions and any errors that occur

## Important Notes

- Ensure your distributor wallet has enough tokens and SOL for transaction fees
- The distribution amount is per holder
- Holders with 0 balance are excluded from distribution
- The distributor wallet is excluded from receiving distributions
- The bot will automatically use Helius or QuickNode RPC URLs if provided in the environment variables

## Security

- Keep your private key secure and never commit it to version control
- Use environment variables for sensitive data
- Consider running on a secure, stable server
