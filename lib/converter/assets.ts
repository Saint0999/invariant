/**
 * assets.ts
 * ---------------------------------------------------------------------------
 * The single list of things the converter can convert between, shared by the
 * rates route handler (server) and the converter UI (client).
 *
 * WHY ONE LIST FOR BOTH KINDS
 * Crypto and fiat are modelled as the same shape on purpose. The converter
 * never has to branch on "is this a crypto-to-fiat conversion or a
 * crypto-to-crypto one" — every asset is priced in USD, so a conversion is
 * always the same division (see usdPerUnit in the rates payload). Adding a
 * currency of either kind is a line in this file and nothing else.
 *
 * `id` is the CoinGecko coin id for crypto and the CoinGecko vs_currency code
 * for fiat; those are the two vocabularies the upstream API speaks. `code` is
 * ours — it is what appears in the UI and in the rates map, and it is the only
 * identifier the client ever handles.
 */

export type AssetKind = "crypto" | "fiat";

export interface Asset {
  /** Ticker shown in the UI and the key in the rates map. Unique across kinds. */
  code: string;
  /** Full name, shown under the ticker and matched against when searching. */
  name: string;
  kind: AssetKind;
  /**
   * Upstream identifier. CoinGecko coin id for crypto ("bitcoin"), lowercase
   * vs_currency code for fiat ("eur").
   */
  id: string;
  /** Mark under /public. Assets without one fall back to a lettered chip. */
  logo?: string;
  /** Currency symbol for fiat, used to prefix formatted output. */
  symbol?: string;
}

/*
  Cryptos. The ids here are verified against CoinGecko's /simple/price — a typo
  is silent upstream (the coin is simply absent from the response) rather than
  an error, so a wrong id shows up as an asset that can never be converted.

  MATIC is deliberately the POL id (polygon-ecosystem-token): Polygon migrated
  the token, and the legacy `matic-network` id still resolves but tracks the
  old, thinly traded asset — quoting it would be quoting a stale market.
*/
export const CRYPTO_ASSETS: Asset[] = [
  { code: "BTC", name: "Bitcoin", kind: "crypto", id: "bitcoin", logo: "/btc.svg" },
  { code: "ETH", name: "Ethereum", kind: "crypto", id: "ethereum", logo: "/eth.svg" },
  { code: "USDT", name: "Tether", kind: "crypto", id: "tether", logo: "/usdt.svg" },
  { code: "USDC", name: "USD Coin", kind: "crypto", id: "usd-coin", logo: "/usdc.svg" },
  { code: "BNB", name: "BNB", kind: "crypto", id: "binancecoin", logo: "/bnb.svg" },
  { code: "SOL", name: "Solana", kind: "crypto", id: "solana", logo: "/sol.svg" },
  { code: "XRP", name: "XRP", kind: "crypto", id: "ripple", logo: "/xrp.svg" },
  { code: "ADA", name: "Cardano", kind: "crypto", id: "cardano", logo: "/ada.svg" },
  { code: "DOGE", name: "Dogecoin", kind: "crypto", id: "dogecoin", logo: "/doge.svg" },
  { code: "AVAX", name: "Avalanche", kind: "crypto", id: "avalanche-2", logo: "/avax.svg" },
  { code: "POL", name: "Polygon", kind: "crypto", id: "polygon-ecosystem-token", logo: "/matic.svg" },
  { code: "ARB", name: "Arbitrum", kind: "crypto", id: "arbitrum", logo: "/arb.svg" },
  { code: "LINK", name: "Chainlink", kind: "crypto", id: "chainlink" },
  { code: "LTC", name: "Litecoin", kind: "crypto", id: "litecoin" },
  { code: "TRX", name: "TRON", kind: "crypto", id: "tron" },
  { code: "DOT", name: "Polkadot", kind: "crypto", id: "polkadot" },
];

/*
  Fiat. Every code here must appear in CoinGecko's
  /simple/supported_vs_currencies — the price call asks for all of them in one
  go, and an unsupported code makes the whole request fail rather than
  degrading, so this list is checked against that endpoint, not guessed.
*/
export const FIAT_ASSETS: Asset[] = [
  { code: "USD", name: "US Dollar", kind: "fiat", id: "usd", symbol: "$" },
  { code: "EUR", name: "Euro", kind: "fiat", id: "eur", symbol: "€" },
  { code: "GBP", name: "British Pound", kind: "fiat", id: "gbp", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", kind: "fiat", id: "jpy", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", kind: "fiat", id: "inr", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", kind: "fiat", id: "aud", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", kind: "fiat", id: "cad", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", kind: "fiat", id: "chf", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", kind: "fiat", id: "cny", symbol: "¥" },
  { code: "SGD", name: "Singapore Dollar", kind: "fiat", id: "sgd", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", kind: "fiat", id: "aed", symbol: "د.إ" },
  { code: "BRL", name: "Brazilian Real", kind: "fiat", id: "brl", symbol: "R$" },
  { code: "KRW", name: "South Korean Won", kind: "fiat", id: "krw", symbol: "₩" },
  { code: "MXN", name: "Mexican Peso", kind: "fiat", id: "mxn", symbol: "MX$" },
  { code: "ZAR", name: "South African Rand", kind: "fiat", id: "zar", symbol: "R" },
  { code: "NGN", name: "Nigerian Naira", kind: "fiat", id: "ngn", symbol: "₦" },
  { code: "TRY", name: "Turkish Lira", kind: "fiat", id: "try", symbol: "₺" },
  { code: "SEK", name: "Swedish Krona", kind: "fiat", id: "sek", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", kind: "fiat", id: "nzd", symbol: "NZ$" },
  { code: "RUB", name: "Russian Ruble", kind: "fiat", id: "rub", symbol: "₽" },
];

export const ASSETS: Asset[] = [...CRYPTO_ASSETS, ...FIAT_ASSETS];

export const ASSETS_BY_CODE: Record<string, Asset> = Object.fromEntries(
  ASSETS.map((asset) => [asset.code, asset]),
);

/** Shape returned by /api/rates. */
export interface RatesPayload {
  /**
   * USD value of ONE unit of each asset, keyed by our `code`. This is the whole
   * conversion model: `amount * usdPerUnit[from] / usdPerUnit[to]` handles
   * crypto→crypto, crypto→fiat, fiat→crypto and fiat→fiat identically.
   */
  usdPerUnit: Record<string, number>;
  /** When the upstream prices were last refreshed, ms since epoch. */
  updatedAt: number;
  /** True when this payload is a cached copy served after an upstream failure. */
  stale?: boolean;
}

/**
 * The one conversion function. Returns null when either leg is missing from the
 * rate table — a missing price must not silently convert at some default, which
 * would show a confident wrong number.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  usdPerUnit: Record<string, number>,
): number | null {
  const fromRate = usdPerUnit[from];
  const toRate = usdPerUnit[to];
  if (!fromRate || !toRate || !Number.isFinite(amount)) return null;
  return (amount * fromRate) / toRate;
}
