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
- **Cat Weight Tracking** — Monitor weight trends for two cats (豌豆黄 & 小立夏) with line charts
- **Period Tracking** — Menstrual cycle calendar, predictions, and statistics
- **Health Checkups** — Medical record tracking with standardized checkup items and normal ranges
- **Yearly Goals** — Goal management with sub-goals and progress tracking for two people (🐷 & 🫏)

## Project Structure

```
pages/
  home/           # Dashboard — expiry alerts, period status, cat weights, goals progress
  items/          # Product management + to-buy list (tab view)
  plan/           # Travel plans + yearly goals (tab view)
  record/         # Cat weight + period tracking + health checkups (tab view)
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

- **Primary Color:** Indigo → Violet gradient (`#6366f1` → `#8b5cf6`)
- **Layout:** Card-based with consistent spacing (`24rpx` margins)
- **Components:** CSS variables for colors, shadows, spacing, border-radius, and transitions
- **Navigation:** Custom navbar + native TabBar (4 tabs: Home, Items, Plan, Record)

## Development

1. Import the project in [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. Set AppID: `wx1815cbe400c07c23`
3. Enable ES6, PostCSS, and minification in project settings
