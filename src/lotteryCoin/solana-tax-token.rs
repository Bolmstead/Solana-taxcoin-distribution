use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint, Transfer, transfer, MintTo, mint_to},
    associated_token::{AssociatedToken, create_associated_token_account},
};
use solana_program::{program::invoke, system_instruction};

declare_id!("YOUR_PROGRAM_ID");

#[program]
pub mod tax_token {
    use super::*;

    // Initialize the token with mint authority, tax rate and treasury
    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        name: String,
        symbol: String,
        decimals: u8,
        tax_rate: u64,
        tax_recipient: Pubkey,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        token_info.mint = ctx.accounts.mint.key();
        token_info.authority = ctx.accounts.authority.key();
        token_info.tax_recipient = tax_recipient;
        token_info.tax_rate = tax_rate; // Represented as basis points (5% = 500)
        token_info.name = name;
        token_info.symbol = symbol;
        token_info.decimals = decimals;

        // Initialize the mint
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        // Mint initial supply to the authority (optional - can set initial_supply as parameter)
        let initial_supply = 1_000_000_000 * 10u64.pow(decimals as u32); // 1 billion tokens
        mint_to(cpi_ctx, initial_supply)?;

        Ok(())
    }

    // Custom transfer function that calculates, collects, and auto-withdraws the tax
    pub fn taxed_transfer(
        ctx: Context<TaxedTransfer>,
        amount: u64,
    ) -> Result<()> {
        let token_info = &ctx.accounts.token_info;
        
        // Calculate tax amount (tax_rate is in basis points: 500 = 5%)
        let tax_amount = amount.checked_mul(token_info.tax_rate).unwrap().checked_div(10000).unwrap();
        let transfer_amount = amount.checked_sub(tax_amount).unwrap();
        
        // Directly transfer the tax to the tax recipient wallet
        if tax_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.tax_recipient.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            transfer(cpi_ctx, tax_amount)?;
        }
        
        // Then transfer the remaining amount to the recipient
        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, transfer_amount)?;
        
        Ok(())
    }
    
    // Function to withdraw collected taxes (only callable by the authority)
    pub fn withdraw_taxes(
        ctx: Context<WithdrawTaxes>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.tax_treasury.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)?;
        
        Ok(())
    }
}

#[account]
pub struct TokenInfo {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub tax_recipient: Pubkey,
    pub tax_rate: u64,    // In basis points (e.g., 500 = 5%)
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
}

#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 32 + 8 + 8,
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TaxedTransfer<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub tax_recipient: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"token_info", token_info.mint.as_ref()],
        bump,
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawTaxes<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = token_info.authority == authority.key()
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(
        mut,
        constraint = tax_treasury.key() == token_info.tax_treasury
    )]
    pub tax_treasury: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
