# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual holders and everyday spenders — people who own some crypto, get paid or shop in a foreign currency, or are just curious what something is worth right now. They land here to check a rate before doing something else (a manual trade or transfer elsewhere, budgeting, converting a price in their head), not to actively trade or monitor markets throughout the day.

## Product Purpose

Invariant is a live, read-only price reference for 16 crypto tokens and 20 world currencies. It exists so a visitor can look up or convert a rate without an account, a wallet connection, or any setup. Success is a fast, trustworthy answer to "what is X worth in Y right now" — nothing here executes a trade, moves funds, or stores anything about the visitor.

## Positioning

One board for both worlds: crypto and fiat are modeled identically under the hood (every asset priced in USD, so a conversion is always the same division), which means any-to-any conversion — crypto→fiat, fiat→crypto, crypto→crypto, fiat→fiat — works the same way through one interface. A neighboring crypto tracker (CoinMarketCap) doesn't convert to world currencies as a first-class citizen, and a currency converter (XE, Google's currency box) doesn't carry crypto. Reinforced by having no account and no wallet connect at all: "start with a number, not a signup."

## Operating Context

Two routes carry the whole product:

- **/converter** — pick two assets (crypto or fiat), type an amount, read the converted value at the live rate.
- **/rates** — the full board: every supported asset's live USD price and 24h change, with an expandable per-row price history chart (1d / 7d / 30d).

Both are read-only tools with no login and nothing to install or connect.

## Capabilities and Constraints

- Rates are sourced server-side from CoinGecko (`/simple/price`, `/simple/price` history) and cached with a 30s TTL for spot rates, 5min TTL for history, so many concurrent visitors share one upstream call rather than each spending their own rate-limit budget.
- Fiat rates and fiat price history are *derived*, not fetched directly — CoinGecko prices coins in fiat but has no direct FX endpoint on this plan, so an FX rate/series is backed out of coin prices quoted in both legs (averaged across coins for spot; derived from Bitcoin's own series for history).
- A stale cached payload is served (up to 10min for spot, 1hr for history) if the upstream call fails, rather than showing an empty converter or chart — a missing quote returns `null` from the conversion function rather than a silently wrong number.
- Adding a new crypto or fiat asset is a single entry in `lib/converter/assets.ts` — the shared list the rates API and the converter UI both read from.
- No accounts, no wallet connection, no custody of funds — the product does not hold or move anything belonging to the visitor.

## Brand Commitments

- Name: **Invariant**.
- Voice: plain and factual about what the product actually does (e.g. the landing copy was deliberately rewritten to stop implying swaps, payouts, or locked rates — features that don't exist). Avoid overselling capability the two read-only routes don't have.
- Visual identity already exists (charcoal/graphite theme, brushed-silver gradient type) and is documented in code comments in `components/landing/InvariantLanding.tsx`; not yet captured in DESIGN.md.

## Evidence on Hand

- The footer currently reads "Non-custodial. Audited." — **non-custodial is true** (there is no account or wallet-connect flow to custody anything through), but **there is no completed security audit**. "Audited" is unconfirmed placeholder copy, not evidence, and future work must not treat it as a claim to build on or repeat elsewhere. Flagged as a copy fix to make (drop the word or replace it with something true) — not fixed as part of this init pass.
- No testimonials, customer logos, press mentions, or usage numbers exist; none should be fabricated.

## Product Principles

1. Read-only, no setup: every surface should keep working with zero account, wallet, or signup — that absence is a stated part of the pitch, not an omission to eventually fill in.
2. One model, not two: crypto and fiat stay the same shape (USD-denominated) everywhere in the product; never introduce a code path that treats one kind as primary and the other as a special case.
3. Never show a confident wrong number: a missing or stale rate must be visibly stale or absent, not silently substituted or defaulted.
4. Say only what the two routes do: copy claims conversion and live rates, nothing about trading, payouts, or custody.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond standard web accessibility practice already reflected in the code (e.g. decorative marks given empty alt text, motion-reduce handling for scroll-driven animation).
