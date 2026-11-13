# 0004: Payments model

- Status: accepted
- Date: 2026-11-10

## Context

Handling the job payment would make us a payment intermediary for every tow and jump start, with
refunds, chargebacks and money transmission questions.

## Decision

Drivers pay providers directly. Providers pay us a flat fee per picked request, taken from a prepaid
wallet, plus optional Pro (subscription, lower fees) and Featured (placement per market) plans.

## Consequences

We never hold job money. We need a wallet ledger, top-ups (Stripe), low-balance handling, credits for
disputes, and clear Provider Terms about fees.
