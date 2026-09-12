# CleanUpLife Frontend

WeChat Mini Program for personal life management — track products, shopping lists, travel plans, pet health, period cycles, medical checkups, and yearly goals.

## Tech Stack

- **Platform:** WeChat Mini Program (native framework)
- **Language:** JavaScript
- **Styling:** WXSS (with CSS variables, gradients, animations)
- **Backend:** [CleanUpLife API](https://github.com/dreamlaters/CleanUpLife)

## Features

- **Product Management** — Track pantry items, cat food, and medicine with expiry date alerts
- **To-Buy List** — Shopping checklist with priority levels
- **Travel Plans** — Domestic/international destination wishlist with visited tracking
- **Cat Care Tracking** — Monitor weight trends and shared play sessions for two cats (豌豆黄 & 小立夏)
- **Period Tracking** — Menstrual cycle calendar, predictions, and statistics
- **Health Checkups** — Medical record tracking with standardized checkup items and normal ranges
- **Yearly Goals** — Goal management with sub-goals and progress tracking for two people (🐷 & 🫏)
- **Retirement Savings** — Shared net-worth goal with personal accounts, mortgage tracking, monthly check-ins, and trends

## Project Structure

```
pages/
  home/           # Dashboard — expiry alerts, period status, cat weights, goals progress
  items/          # Product management + to-buy list (tab view)
  cat/            # Cat weight + shared play tracking (tab view)
  plan/           # Yearly goals + retirement savings + travel wishes (tab view)
  health/         # Period tracking + health checkups (tab view)
  record/         # Compatibility redirect for legacy links
  add/            # Add new product form
  update/         # Edit product form
  tobuy/          # Add/edit to-buy items
  pet/            # Pet weight management
  checkup/        # Add/view health checkup records
  openid/         # Push notification settings
  blocked/        # Access denied page

components/
  custom-navbar/  # Reusable navigation bar (title mode & greeting mode)
  loading-state/  # Loading spinner
  empty-state/    # Empty data placeholder with optional action button
  footer-link/    # Push notification settings link
  action-sheet/   # Edit/delete action menu

utils/
  api.js          # REST API client with auto-retry on token expiration
  constants.js    # Categories, locations, countries, checkup definitions
  util.js         # Date formatting, modals, debounce utilities
  filters.wxs     # WXS filters for template-side data processing

behaviors/
  productFormBehavior.js  # Shared form logic for product add/update pages
```

## Design System

- **Direction:** Warm dual-person life journal with lightweight paper and handwritten-note details
- **Palette:** Warm ivory, terracotta, sage, and dark brown with semantic health/status colors
- **Layout:** Clear information hierarchy, restrained cards, consistent `24rpx` page gutters, and accessible touch targets
- **Icons:** Local line-icon component with small, purposeful journal illustrations; Emoji is reserved for people and pets
- **Navigation:** Branded custom navbar, shared segmented controls, and native TabBar (Home, Items, Cats, Plan, Health)

## Development

1. Import the project in [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. Set AppID: `wx1815cbe400c07c23`
3. Enable ES6, PostCSS, and minification in project settings

### Home dashboard contract and rollout

Deploy the compatible backend **before releasing this frontend**. Home now makes one authenticated business request to `GET /Home/dashboard?year=YYYY`, covering `products`, `toBuy`, `goals`, `weights`, `period`, `play`, and `savings`. It no longer downloads the unused travel list or full goal/account documents. There is deliberately no fallback fan-out to legacy endpoints, including when the new endpoint returns 404.

- Each requested section has an explicit `ok` or `error` result. Successful empty records are different from unavailable data; malformed or missing section data is also shown as unavailable.
- Healthy sections remain visible during section retries. Retry buttons send only failed section names through the optional comma-separated `sections` query parameter.
- An HTTP 503 section envelope is still an error response, but its section details remain available for display. Global and network failures have visible retry states rather than zero counts.
- Timeout and dependency failures use fixed Chinese messages selected by error code. Home does not display backend exception text.
- The reminder all-clear requires successful product, play, and savings sources. Incomplete reminder totals are labeled as known reminders, not exact totals.
- Full refreshes are serialized and coalesced. Returning to home while a previous request is pending schedules a fresh full refresh and prevents the superseded result from being rendered.

`api.getHomeDashboard(year, sections = null, options = {})` disables generic loading/error toasts by default because home renders these states inline. Other API calls retain their default behavior. Non-auth HTTP errors expose `error.statusCode` and `error.data`; the existing GET network retries, single-flight 401 refresh, 403 redirect, and **no automatic write replay** behavior remain unchanged. Transport/auth retries can therefore make more than one HTTP attempt for one logical home refresh.

The backend's configurable per-section wait budget (default 5 seconds) is not an end-to-end response-time guarantee. This client does not extend timeouts or introduce caching. The existing request wrapper does not expose cancellation; an unloaded home page ignores pending replies and does not start queued refreshes.

### Targeted tests

With Node.js 18 or later, run from this repository directory:

```powershell
node --test .\tests\api.test.js .\tests\home-dashboard.test.js
```

These dependency-free `node:test` suites run the real API and home code in VM contexts with mocked `wx`, `getApp`, and `Page`. They cover request paths/counts, display formatting, complete reminders, empty/error states, targeted retries, all-failed 503s, malformed/global/network failures, refresh ordering, and the existing authentication/write-replay protections.

The tests check state and WXML visibility guards, not native layout or live-service performance. Before releasing, verify partial failures/retry buttons and navigation in WeChat DevTools/on-device, then measure authenticated loading against the deployed compatible backend.
