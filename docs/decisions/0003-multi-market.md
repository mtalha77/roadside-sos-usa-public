# 0003: Multi-market from day one

- Status: accepted
- Date: 2026-11-10

## Context

The business launches city by city. Hardcoding a city, phone number or price would make every
launch a code change and risk wrong data in other cities.

## Decision

Every request, provider, price, fee, phone number and page belongs to a market row. Launching a city
is an admin action. Fees are dated rows (history kept), so old requests keep the fee they had.

## Consequences

Every query filters by market; RLS policies are market-aware; pages are generated from the database.
