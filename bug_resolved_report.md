# Bug Resolution Report: Permit-Wiz

This document details every technical fix applied across two audit rounds.  
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
`next` and `eslint-config-next` both updated to `16.2.2`.

---