# Bug Resolution Report: Permit-Wiz

This document details every technical fix applied across three audit rounds.  
**Status: Final Audit Passed — All findings resolved. Production-ready.**

---

## Round 1 — Original 32 Findings

### 🛑 Critical

#### 1. Broken JS Code Export Snippet
**Problem:** Exported snippet called `walletClient.writeContract()` but never defined `walletClient`.  
**Fix:** Updated the export template in [CodeExport.tsx](components/permit/CodeExport.tsx) to initialise a `walletClient` via `createWalletClient`, `custom(window.ethereum)`, and correct viem chain definitions.

#### 2. Wrong Import Path in JS Code Export
**Problem:** Snippet used `import { rootstock } from './chains'` which didn't exist.  
**Fix:** Corrected to use standard `viem/chains` identifiers resolved dynamically from `domain.chainId`.

#### 3. Code Export Injection Vulnerability
**Problem:** Token metadata was interpolated into template strings, allowing XSS / code injection.  
**Fix:** Implemented `escapeString` and `escapeComment` helpers in [CodeExport.tsx](components/permit/CodeExport.tsx) to sanitise all token metadata before interpolation.

#### 4. Unstable `onVerified` Callback Loop
**Problem:** Inline functions passed as props caused infinite re-renders in [VerificationBadge](components/permit/VerificationBadge.tsx).  
**Fix:** Wrapped `onVerified` in `useCallback` in [app/page.tsx](app/page.tsx); stabilised internal dependencies with `useRef`.

#### 5. Async Cleanup in Verification Flow
**Problem:** State updates on unmounted components after async signature recovery.  
**Fix:** `AbortController` pattern added to [useVerifyPermit.ts](hooks/useVerifyPermit.ts) and [VerificationBadge.tsx](components/permit/VerificationBadge.tsx).

#### 6. Race Conditions in Token Data Fetching
**Problem:** Fast typing / multiple fetches caused stale data to overwrite the UI.  
**Fix:** Added a `runId` guard in [usePermitData.ts](hooks/usePermitData.ts) that increments on every fetch; stale callbacks are discarded via `useRef` comparison.

---

### 🔥 High Severity

#### 7. Wizard Step "Build" Activation
**Fix:** `onStepChange` callbacks added to [PayloadForm.tsx](components/permit/PayloadForm.tsx); active step index managed in the main layout.

#### 8. Single-Click "Switch Chain & Sign"
**Fix:** [SigningStudio.tsx](components/permit/SigningStudio.tsx) refactored to call `switchChainAsync` and then immediately sign in one click.

#### 9. Unsafe Type Assertion for Chain ID *(re-addressed in Round 2)*
**Original fix:** `as 30 | 31` type cast.  
**Round 2 fix:** See entry #R2-1 below for the runtime validation replacement.

#### 10. Clipboard Error Handling
**Fix:** All clipboard calls wrapped in `try/catch`; `navigator.clipboard` existence checked before use.

#### 11. Domain Separator Verification
**Fix:** On-chain `DOMAIN_SEPARATOR()` fetched and compared with locally computed hash; mismatch surfaced as a warning.

#### 12. Token Metadata Caching
**Fix:** Module-level `Map` cache in [usePermitData.ts](hooks/usePermitData.ts) keyed by `chainId-address-owner`.

#### 13. Parallel RPC Calls
**Fix:** All independent contract reads grouped into a single `Promise.all` block.

#### 14. RPC Fallbacks & Timeouts
**Fix:** Wagmi configured with `fallback()` transports using multiple public Rootstock nodes in [lib/wagmi.ts](lib/wagmi.ts).

---

### ⚡ Medium Severity

#### 15. Zod Validation Integration
**Fix:** `permitFormSchema` from [lib/schemas.ts](lib/schemas.ts) integrated into [PayloadForm.tsx](components/permit/PayloadForm.tsx).

#### 16. Allow Value = 0
**Fix:** Zod schema and UI updated to accept `0` (permit revocation use-case).

#### 17. Deadline Re-validation *(re-addressed in Round 2)*
**Original fix:** Real-time UI warning for past deadlines.  
**Round 2 fix:** See entry #R2-3 for the build-time guard added to `handleBuildPayload`.

#### 18. `parseUnits` Error Handling
**Fix:** `parseUnits` wrapped in `try/catch` with user-friendly error messages.

#### 19–22. UI & Performance
- Font variables corrected in [globals.css](app/globals.css) and [layout.tsx](app/layout.tsx).
- Heavy components wrapped in `next/dynamic` to reduce initial TTI.
- `will-change: transform` added to GPU-accelerate background gradients on mobile.

---

### 🛠️ Low Severity & Informational

#### 23–28. Refactoring
- Removed `as never` type casts.
- Updated README with correct Next.js version.
- `setTimeout` cleanup implemented via `useRef` to prevent memory leaks.
- Code Export chain logic made dynamic from `domain.chainId`.

#### 29–31. Extras
- **Security Headers (partial):** Added `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`. CSP was missing — addressed in Round 2 (#R2-4).
- **Log Cleanup (partial):** Several `console` statements gated. Remaining ungated calls fixed in Round 2 (#R2-8).
- **Unit Testing:** [Vitest](tests/eip712.test.ts) added for core EIP-712 logic.

---

## Round 2 — Second Audit Findings (All Fixed)

### 🔴 HIGH — Vulnerability

#### R2-1. Unsafe chainId Type Assertion — `SigningStudio.tsx:64`
**Problem:** `domain.chainId as 30 | 31` is a compile-time cast only. If an unsupported `chainId` reached the domain object, `switchChainAsync` would receive an invalid value silently.  
**Fix applied in:** [SigningStudio.tsx](components/permit/SigningStudio.tsx)  
```ts
// Before (unsafe cast)
await switchChainAsync({ chainId: domain.chainId as 30 | 31 });

// After (runtime validation)
if (domain.chainId !== 30 && domain.chainId !== 31) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[PermitWiz] Unsupported chainId: ${domain.chainId}`);
  }
  return; // bail early — never call switchChainAsync
}
await switchChainAsync({ chainId: domain.chainId }); // type-safe: 30 | 31 inferred
```

---

### 🟡 MEDIUM — Bugs

#### R2-2. Async IIFE Inside `setRunId` State Updater — `hooks/usePermitData.ts:242-419`
**Problem:** An async IIFE was nested inside a `setState` updater function. React may call updater functions multiple times in Strict Mode / concurrent rendering, causing undefined behaviour (double-fetches, race conditions).  
**Fix applied in:** [hooks/usePermitData.ts](hooks/usePermitData.ts)  
- Replaced `const [runId, setRunId] = useState(0)` with `const runIdRef = useRef(0)`.
- Run guard now reads/writes `runIdRef.current` directly — safe across renders.
- All post-`await` points check `if (runIdRef.current !== currentRunId) return;` before touching state.
- No IIFE, no `setState` updater with async code.

#### R2-3. Deadline Not Re-validated at Build Time — `components/permit/PayloadForm.tsx:69-95`
**Problem:** A valid deadline typed before idling would pass Zod validation but produce an already-expired permit on click.  
**Fix applied in:** [PayloadForm.tsx](components/permit/PayloadForm.tsx)  
```ts
if (dl <= BigInt(Math.floor(Date.now() / 1000))) {
  setBuildError("Deadline is in the past. Please set a future deadline before building the permit.");
  return;
}
```

#### R2-4. Missing Content-Security-Policy Header — `next.config.ts`
**Problem:** The previous iteration only added `X-Frame-Options`, `X-Content-Type-Options`, and `HSTS`. No CSP header was present, leaving the app vulnerable to XSS-based signature theft.  
**Fix applied in:** [next.config.ts](next.config.ts)  
A richly documented, restrictive CSP was added covering:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` *(required for Next.js bootstrap chunks)*
- `connect-src` scoped to Rootstock public RPC nodes + WalletConnect WSS relay
- `frame-ancestors 'none'` (mirrors X-Frame-Options DENY)
- `object-src 'none'`, `upgrade-insecure-requests`

Additionally added: **`Referrer-Policy: strict-origin-when-cross-origin`** and **`Permissions-Policy: camera=(), microphone=(), geolocation=()`**.

#### R2-5. `escapeString` Does Not Escape `$` — `components/permit/CodeExport.tsx:6`
**Problem:** Tokens with `${...}` sequences in their `name` or `symbol` fields could produce template literal injection in the exported JavaScript code.  
**Fix applied in:** [CodeExport.tsx](components/permit/CodeExport.tsx)  
```ts
// Before
const escapeString = (str) => str.replace(/['"`\\]/g, '\\$&')...
// After — $ added to character class
const escapeString = (str) => str.replace(/['"`$\\]/g, '\\$&')...
```

---

### 🟢 LOW — Vulnerabilities & Informational

#### R2-6. Token Cache Has No TTL — `hooks/usePermitData.ts:35`
**Problem:** A nonce fetched in a previous session would be served from the module-level `Map` indefinitely, producing invalid signatures on replay.  
**Fix applied in:** [hooks/usePermitData.ts](hooks/usePermitData.ts)  
- Added `CACHE_TTL_MS = 5 * 60 * 1000` (5 minutes).
- Each cache entry now stores a `storedAt: number` timestamp.
- `getCacheEntry()` helper deletes and returns `null` for any entry older than TTL.
- The cache auto-invalidates when the user reconnects or switches chains (the cache key changes with `chainId`).

#### R2-7. `npm test` Fails — No Test Script — `package.json`
**Problem:** `vitest` was installed as a dev dependency and tests existed in `tests/eip712.test.ts`, but no `"test"` script was wired up in `package.json`.  
**Fix applied in:** [package.json](package.json)  
```json
"scripts": {
  "test": "vitest run"
}
```

#### R2-8. 6 Ungated `console` Statements — `hooks/usePermitData.ts`
**Problem:** Production builds would leak internal diagnostic data via `console.log/error/warn`.  
**Fix applied in:** [hooks/usePermitData.ts](hooks/usePermitData.ts)  
All remaining `console` calls (including the DOMAIN_SEPARATOR check, contract existence check, and nonce error paths) gated with `process.env.NODE_ENV !== "production"`.

#### R2-9. `ConnectButton` Hard-wires `connectors[0]` — `components/shared/ConnectButton.tsx:39`
**Problem:** In multi-wallet environments (MetaMask + Coinbase + WalletConnect), the button always connected through the first registered connector silently, with no user choice.  
**Fix applied in:** [ConnectButton.tsx](components/shared/ConnectButton.tsx)  
- Single connector → connects directly (no regression).
- Multiple connectors → renders an accessible dropdown `role="listbox"` picker so the user selects their wallet.
- Each connector button shows a per-connector loading indicator when `isPending`.

#### R2-10. Accessibility: Icon Buttons Missing `aria-label`, Stepper Missing `aria-current` 
**Problem:** Screen readers could not identify the purpose of icon-only buttons or the active wizard step.  
**Fixes applied:**  
- [CodeExport.tsx](components/permit/CodeExport.tsx): `CopyButton` gains `aria-label` prop; decorative icons marked `aria-hidden="true"`.
- [SigningStudio.tsx](components/permit/SigningStudio.tsx): Show/hide toggle and Copy button now carry descriptive `aria-label` attributes.
- [WizardStepper.tsx](components/permit/WizardStepper.tsx): Active step button gains `aria-current="step"` and a descriptive `aria-label` summarising step state.
- [ConnectButton.tsx](components/shared/ConnectButton.tsx): Disconnect, wallet picker, and per-connector buttons all carry `aria-label`.

#### R2-11. Next.js Moderate CVE — Upgrade from `16.1.6` to `16.2.2`
**Problem:** `next@16.1.6` carried a moderate-severity CVE.  
**Fix applied in:** [package.json](package.json) and installed via `npm install`.  
`next` and `eslint-config-next` both updated to `16.2.2`. *(Further upgraded in Round 3 — see #R3-C1.)*

---

## Round 3 — Post-Fix Audit (All Resolved)

The Round 2 fix commit itself was re-audited and produced eleven new findings.
All are now resolved. Tests: **14/14 passing**. Production build: **clean (no
warnings)**. Lint: **clean (0 errors, 0 warnings)**.

### 🛑 CRITICAL / HIGH

#### R3-C1. Next.js DoS CVE Regression — Upgrade from `16.2.2` to `16.2.6`
**Severity:** VULN HIGH (CVSS 7.5, GHSA-q4gf-8mx6-v5v3 — DoS via Server Components, vulnerable range `>=16.0.0-beta.0 <16.2.3`)
**Problem:** Round 2 upgraded to `16.2.2`, which carries a higher-severity CVE than the moderate one being remediated. For a cryptographic signing tool, any DoS surface is unacceptable.
**Fix applied in:** [package.json](package.json) — `next` and `eslint-config-next` both updated to `^16.2.6` (latest stable in the 16.2 line) and installed via `npm install`. The vulnerable range is closed.

#### R3-C2. CSP `script-src 'unsafe-inline'` in Production — Nonce-Based Replacement
**Severity:** VULN MED (XSS-mitigation regression)
**Problem:** The Round 2 CSP set `'unsafe-inline'` in `script-src` permanently for production, which negates most XSS protection. An injected script could swap the displayed snippet, exfiltrate the wallet address, or modify deadline/spender before signing.
**Fix applied in:** [proxy.ts](proxy.ts) *(new)* and [next.config.ts](next.config.ts) and [app/layout.tsx](app/layout.tsx).
- Introduced a Next.js 16 **proxy** (the non-deprecated successor to `middleware`) that generates a fresh 128-bit base64 nonce per request via `crypto.getRandomValues`.
- The proxy sets the nonce on the `x-nonce` request header and embeds it into the response `Content-Security-Policy` as `script-src 'self' 'nonce-<random>' 'strict-dynamic'` *(production)* or `'self' 'unsafe-inline' 'unsafe-eval'` *(development only, required by HMR/error overlay)*.
- The root layout now calls `await headers()` so that pages opt out of static generation and Next.js automatically nonces its bootstrap `<script>` tags from the request header.
- The static CSP block was removed from `next.config.ts`; all other security headers (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`) remain in place.
- Hardened directives added: `base-uri 'self'`, `form-action 'self'`.

---

### 🟡 OTHER FINDINGS

#### R3-N1. Error Containers Missing `role="alert"`
**Problem:** Dynamic error divs in `PayloadForm.tsx` (build-error panel) and `SigningStudio.tsx` (sign-error panel) were not announced to screen readers. WCAG 4.1.3.
**Fix applied in:** [PayloadForm.tsx](components/permit/PayloadForm.tsx), [SigningStudio.tsx](components/permit/SigningStudio.tsx), and [VerificationBadge.tsx](components/permit/VerificationBadge.tsx) — every dynamic error container now carries `role="alert"` together with an appropriate `aria-live` (`assertive` for errors, `polite` for warnings). Decorative icons inside the alerts are marked `aria-hidden="true"`.

#### R3-N2. Owner Input Not Associated with its Label
**Problem:** The Owner `<Input>` in the Build step was not programmatically associated with its `<Label>`. WCAG 1.3.1.
**Fix applied in:** [PayloadForm.tsx](components/permit/PayloadForm.tsx) — `<Label htmlFor="owner">` paired with `<Input id="owner" readOnly disabled />`. `readOnly` was added so assistive tech can still read the value while keeping it visually disabled.

#### R3-N3. `VerificationBadge` Copy Buttons Missing `aria-label`
**Problem:** Icon-only copy buttons inside `AddressRow` and `SigField` had no accessible name; the raw-signature copy button was missing one too.
**Fix applied in:** [VerificationBadge.tsx](components/permit/VerificationBadge.tsx) — each copy button now has a descriptive, state-aware `aria-label` (e.g. `"Copy owner address to clipboard"` → `"Owner address copied"`). The match/mismatch ✓/✗ glyph also gains an `aria-label`. All icons are marked `aria-hidden="true"`.

#### R3-N4. `ConnectButton` Dropdown Missing Escape Key & Focus Management
**Problem:** WCAG 2.1.2 — the listbox could be opened by keyboard but not dismissed with `Escape`, focus was not moved into the listbox on open, and focus was not returned to the trigger on close.
**Fix applied in:** [ConnectButton.tsx](components/shared/ConnectButton.tsx) — added an effect that, while the dropdown is open, listens for `Escape` on `document` and closes the dropdown (returning focus to the trigger via a stored `ref`). An outside `pointerdown` also dismisses the dropdown. When the dropdown opens, the first non-disabled wallet option is focused automatically.

#### R3-N5. Ungated `console.error` in `VerificationBadge`
**Problem:** A single `console.error` in the clipboard error handler was not gated by `process.env.NODE_ENV`, allowing diagnostic noise in production bundles.
**Fix applied in:** [VerificationBadge.tsx](components/permit/VerificationBadge.tsx:78-82) — wrapped in the standard `if (process.env.NODE_ENV !== "production")` guard.

#### R3-N6. Zod Schema Does Not Reject Past Deadlines
**Problem:** Defense-in-depth gap — the build-time check in `handleBuildPayload` covered the user-facing case, but a schema-only consumer could still construct an expired permit.
**Fix applied in:** [lib/schemas.ts](lib/schemas.ts) — added `.refine(v => Number(v) > Math.floor(Date.now() / 1000), "Deadline must be in the future")` to the deadline schema. Covered by three new unit tests in `tests/schemas.test.ts`.

#### R3-N7. PayloadForm Does Not Reactively Refetch on Chain/Wallet Change
**Problem:** TTL + cache-key partitioning prevented stale data being served, but the form did not refetch when `useChainId()` or `useAccount()` changed. Users could see "no data" silently after a switch until they clicked Fetch again.
**Fix applied in:** [PayloadForm.tsx](components/permit/PayloadForm.tsx)
- New `useEffect` watches `chainId` and `address`. When either changes:
  - Surfaces a `role="status"` UX hint *(“Network or wallet changed — refreshing token data for the new context.”)*
  - Automatically triggers `fetch()` so the on-screen token data, nonce, and domain reflect the new context.
- A previous-context `useRef` prevents the effect from firing on initial mount.

#### R3-N8. Test Coverage — New Suites for Deadline & Cache TTL
**Problem:** Only two tests existed (EIP-712 domain construction).
**Fixes applied:**
- Extracted the in-memory cache into [lib/tokenCache.ts](lib/tokenCache.ts) (`buildCacheKey`, `getCacheEntry`, `setCacheEntry`, `clearCache`, exported `CACHE_TTL_MS`). `hooks/usePermitData.ts` now imports from it.
- Added [tests/tokenCache.test.ts](tests/tokenCache.test.ts) (5 tests): case-insensitive key construction, chainId partitioning, fresh-entry retrieval inside TTL, eviction past TTL via `vi.useFakeTimers`, and null returns for unknown keys.
- Added [tests/schemas.test.ts](tests/schemas.test.ts) (7 tests): deadline-strictly-future accepted, deadline equal to now rejected, deadline in past rejected, non-numeric deadline rejected, `value = 0` accepted (permit revocation), malformed spender rejected, negative value rejected.
- Result: **14 tests across 3 files — all passing**.

#### R3-N9. `wagmi` Single-Connector Configuration *(decision)*
**Status:** Resolved as **intentional** — left as-is for now.
The new multi-connector dropdown in `ConnectButton.tsx` is fully reachable when additional connectors are registered. Today we ship with `injected()` only (Rootstock dApps are predominantly MetaMask/Liquality), so the single-connector branch renders. Adding WalletConnect later does not require any UI work — the dropdown branch will activate automatically when `connectors.length > 1`.

#### R3-N10. Dynamic Imports Without Loading Fallback
**Problem:** The three lazily-loaded components (`SigningStudio`, `VerificationBadge`, `CodeExport`) had no visible feedback during chunk load.
**Fix applied in:** [app/page.tsx](app/page.tsx) — added a shared `ChunkLoadingSkeleton` component (`role="status"`, `aria-live="polite"`, descriptive label, animated spinner) and wired it to each `dynamic(...)` call via the `loading:` option. Each loader passes the component name so screen readers announce *“Loading signing studio…”* etc.

#### R3-N11. `WizardStepper` Decorative Icon Missing `aria-hidden`
**Problem:** The `Check` icon for completed steps and the ping-animation ring on the active step were not marked decorative.
**Fix applied in:** [WizardStepper.tsx](components/permit/WizardStepper.tsx) — added `aria-hidden="true"` to the `<Check>` icon, the step-number `<span>`, and the active-step ping ring. The descriptive `aria-label` on the step button already conveys all relevant state.

---

### Verification

| Check | Result |
| --- | --- |
| `npm test` | ✅ 14/14 tests passing across 3 files |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit` | ✅ no errors |
| `npm run build` | ✅ compiled successfully, no deprecation warnings |
| `npm audit` *(`next` CVE)* | ✅ GHSA-q4gf-8mx6-v5v3 no longer applicable (`next@16.2.6 ≥ 16.2.3`) |

---