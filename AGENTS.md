# AGENTS.md — ENMAR E-commerce Website

## Project Overview
Build a full-stack e-commerce website for **ENMAR**, an organic food brand based in Bangladesh, selling premium organic products (honey, dates, ghee, oils, spices, grains, organic-certified health products). Brand identity: earthy brown tones with a botanical monogram logo (logo file provided in `/assets/logo`).

Target audience: Bangladeshi customers. UI should default to Bengali with an English toggle.

## Tech Stack
- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS — theme colors pulled from the logo's earthy brown / botanical palette
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js (email/password + phone OTP login)
- **Payments:** SSLCommerz (covers bKash, Nagad, Rocket, card) + Cash on Delivery
- **Image hosting:** Cloudinary or optimized next/image from /public
- **Deployment target:** Vercel (frontend); flag if a separate backend/VPS is needed for webhook or courier-API processing

## Product Catalog — Full Category Range (all included from day one)
Honey · Oils & Ghee · Dates · Spices · Nuts & Seeds · Tea & Coffee · Rice, Flour & Pulses (Dal) · Organic-certified specialty/health items · Combo/Bundle deals · Pickles/Preserves

Product schema fields: name, category, subcategory, price, discounted price (optional), stock quantity, unit (kg/g/ml/L/piece), images (multiple), description, organic-certified badge (boolean), combo/bundle flag with linked products.

## Core Customer-Facing Features
1. Homepage — hero banner, featured categories, best sellers, testimonials, trust badges
2. Category & listing pages with filters (price, category, organic-certified, in-stock)
3. Product detail page — gallery, price, stock status, quantity selector, related products
4. Cart — persistent (localStorage + synced to account), free-shipping threshold nudge
5. Checkout — guest + logged-in, address form, payment method selection
6. **Order tracking system** (see dedicated section below)
7. User account — profile, saved addresses, order history, wishlist
8. Search with autocomplete
9. WhatsApp/Messenger floating contact button
10. Combo/bundle pages showing savings %

## API Integration (Two-Way — Import & Export)

### A. Import products from external sources
- Add an **API Import** section in the admin panel where the admin can configure a connection to an external website/marketplace API (endpoint URL, API key/auth token, and a field-mapping interface to match the external source's product fields — name, price, images, category, stock — to ENMAR's product schema)
- Support both a manual "sync now" trigger and an optional scheduled sync (e.g., every X hours) that the admin can turn on/off
- Show a preview/review step before imported products go live (admin approves what gets published, rather than auto-publishing everything blindly) — at minimum for the first sync with any new source
- Log each import run (success/failure count, errors) so the admin can troubleshoot a bad sync
- Since external APIs vary widely, build this as a configurable/generic connector (URL + auth + field mapping) rather than hardcoding support for one specific external platform — flag if a specific external site is identified later so the agent can tailor the integration

### B. Expose ENMAR's own product data via API (for other sites to consume)
- Add an **API Access** section in the admin panel where the admin can generate/revoke API keys for external consumers
- Build a REST API (e.g., `/api/v1/products`, `/api/v1/products/:id`) that returns public product catalog data (name, price, description, images, stock status, category) to authenticated requests
- **Only expose public-safe data** — never expose internal cost/margin data, customer information, order data, or admin credentials through this public API, regardless of what the requester asks for
- Require an API key (passed via header) for access; apply rate limiting to prevent abuse
- Admin panel should show API usage logs (which key, how many requests) so usage can be monitored, and allow instantly revoking a compromised key
- Document the API endpoints (a simple auto-generated or hand-written API reference page) so the admin can hand it to whoever is building the consuming site

## Theme Customization (admin-controlled)
- Add a **Theme Settings** section in the admin panel, separate from one-time branding setup, that lets the admin adjust the site's visual theme at any time:
  - Color palette — primary, secondary, accent, background, text colors (color pickers, not code edits), with a live preview before saving
  - Typography — choose from a curated set of pre-approved Google Font pairings (heading/body) rather than free-text font names, to avoid breaking the design
  - Optional: light/dark mode toggle for the storefront, if desired later (build the CSS variable structure to support this even if dark mode isn't turned on at launch)
  - Button/corner style (e.g., rounded vs. sharp corners) as a simple preset choice, not full layout rebuilding — avoid turning this into a full page-builder, which is a much bigger scope than intended here
- Implement using CSS custom properties (Tailwind theme extended with CSS variables) driven by values stored in the database, so a theme change takes effect site-wide without a code deploy
- Changes should be previewable by the admin before publishing live (e.g., a "preview" state vs. "published" state)
- This is about visual customization (colors/fonts/basic style), not restructuring page layouts or component logic — keep scope contained so it doesn't balloon into a page-builder project

## Image Upload — Everywhere, Unlimited, Directly From Device
- Every place an image is used across the site (logo, favicon, product images, homepage banners, category images, promo banners, testimonial photos, etc.) must support **direct upload from the admin's device** (phone/computer file picker or drag-and-drop) — not just a URL-paste field
- **No artificial cap on the number of images** — e.g., a product should allow adding as many gallery images as the admin wants, banners/carousels should allow as many slides as the admin wants, not a hardcoded limit like "max 5 images"
- Uploaded images should be automatically optimized/resized (via Cloudinary or a similar pipeline already planned in the tech stack) so unlimited uploads don't hurt page load speed — enforce reasonable technical limits only where needed for performance (e.g., max file size per upload, auto-compression), not an arbitrary count limit
- Admin should be able to reorder, preview, and delete uploaded images easily in the admin UI
- Build one reusable image-upload component used consistently across all these admin forms, rather than reimplementing upload logic per feature

## Ads & Promotions Management (admin-controlled)
- Add an **Ads/Promotions** section in the admin panel to manage all promotional placements without code changes:
  - Homepage promo banners/carousel (image, link, active date range, display order) — already noted under Content management, reinforced here specifically for promotional/sale banners (not just brand banners)
  - Site-wide announcement bar (e.g., "Free delivery this week" / Eid sale notice) — text, link, color, on/off toggle
  - Category or product-page promotional badges (e.g., "Sale," "New," "Limited Stock") — admin can enable per product/category
  - Pop-up/modal promotions (e.g., first-order discount pop-up) — admin can create, schedule (start/end date), and toggle on/off
  - If third-party ad networks are ever wanted (e.g., Google AdSense) later, the admin should be able to paste an ad-unit ID/script into a settings field rather than it being hardcoded — but do not build this unless/until it's actually needed; keep the schema flexible enough to add later
- All promotions should support scheduling (auto-activate/deactivate by date) so the admin doesn't have to manually turn things on/off in real time

## Overarching Principle: Everything Admin-Controlled, Nothing Hardcoded
This brief has repeatedly emphasized admin-configurable settings (branding, content, notifications, AI, ads). Treat this as a standing rule for the whole project, not just the items explicitly listed: **whenever a piece of content, credential, or setting could plausibly change without a code change (text, images, prices, toggles, third-party service credentials, promotional content), it belongs in the database with an admin UI — not hardcoded in the codebase.** The only things that should require a code change are actual structural/logic changes to how the site functions.

## Site Content — Fully Dynamic, Nothing Hardcoded
The entire site's branding and content must be database-driven and editable from the admin panel — **no hardcoded text, images, logo, or favicon in the codebase**. This includes:
- **Site identity:** logo (upload/replace), favicon (upload/replace), site name/tagline, brand color palette (if the admin wants to adjust the theme later without a code change)
- **All customer-facing text:** homepage headline/subtext, section titles, button labels, footer text, About/Contact page content, policy pages (shipping, return, privacy) — store as editable content blocks, not hardcoded JSX strings
- **Meta/SEO fields:** page titles, meta descriptions, social share image — editable per page
- **Homepage sections:** banners/carousel images + links, featured category selection, testimonial entries — already covered under admin Content management, reinforcing here that literally nothing on the public site should require a code deployment to change
- Build this as a `SiteSettings`/`ContentBlock` model in the database (key-value or structured per section) that the frontend reads at render time, with an admin UI to edit each field (including image upload for logo/favicon)
- Provide sensible default seed values (from the initial logo/branding provided) so the site isn't blank on first launch, but every one of those defaults must be admin-editable afterward

## User Experience Principle (applies throughout)
Design every screen — customer-facing and admin — with the actual end user in mind, not just technical completeness: clear navigation, obvious next steps (e.g., what to do after adding to cart), minimal steps to checkout, readable typography and spacing, mobile-first (most Bangladeshi shoppers will be on phones), and fast load times. When choices exist between a technically simpler option and a more user-friendly one, prefer the user-friendly one and flag the tradeoff.

## Responsive Design — Distinct, Polished Mobile & Desktop Experiences
- Do not just shrink/scale the desktop layout for mobile — design mobile and desktop as two intentional experiences sharing the same brand and data:
  - **Mobile (majority of traffic):** bottom navigation bar or easy thumb-reach menu, single-column product grids, simplified filters (e.g., slide-up filter sheet instead of a sidebar), sticky "Add to Cart"/checkout button, large tap targets, fast-loading images
  - **Desktop:** make use of the wider space — multi-column product grids, sidebar filters, hover states on product cards, a more spacious hero/banner layout — should feel premium and full, not like a stretched mobile page
- Use Tailwind's responsive breakpoints deliberately (not just `sm:`/`md:` scaling of the same components) — where it makes sense, use different component structures per breakpoint (e.g., a mobile filter drawer vs. a desktop filter sidebar) rather than one component awkwardly serving both
- Test and review both views at each major milestone (not just at the end) — homepage, listing, product detail, cart/checkout, and the order tracking page all need both a mobile and desktop pass
- Admin panel: desktop-first is acceptable (admins are more likely to use a computer), but it should still be usable on a tablet/large phone for on-the-go order management

## Order Tracking System (required feature)
- Every order gets a unique tracking ID at checkout completion
- Order status stages: `Pending → Confirmed → Packed → Shipped → Out for Delivery → Delivered` (+ `Cancelled`/`Returned` as exception states)
- Customer-facing tracking page: enter tracking ID (or auto-shown in account order history) → shows current stage as a visual timeline/stepper, estimated delivery date, courier name + courier tracking number once shipped
- Real-time-ish updates: status change in admin panel instantly reflects on customer tracking page (no page-refresh-only updates — use polling or websockets)
- Auto SMS/email to customer on every status change ("Your order has been shipped" etc.)
- Data model must support a `courier_partner` and `courier_tracking_id` field so it can plug into Pathao/Steadfast courier APIs later (phase 2) for automatic status sync from the courier's system — build the schema now even if the live API integration comes later
- Admin can manually update status in the interim (before courier API integration goes live)

## Admin Panel (must be fully self-service — no code changes for daily ops)
1. Dashboard — sales overview, recent orders, low-stock alerts
2. Product management — add/edit/delete, bulk CSV upload, category management
3. Order management — view orders, update status (drives the tracking system above), print invoice/packing slip
4. Inventory — auto-decrement stock on order, low-stock alert to admin
5. Customer management — customer list, order history per customer
6. Discount/coupon code management
7. Analytics — top products, revenue by period, category performance
8. Content management — edit homepage banners/testimonials without code changes
9. **Site Identity & Branding management** — upload/replace logo, favicon, edit site name/tagline, edit all site-wide text content blocks and SEO meta fields (see "Site Content — Fully Dynamic" section above)

## Notification Gateway Settings (admin-configured, same pattern as AI Settings)
- Add a **Notification Settings** section in the admin panel where the admin can configure:
  - **SMS gateway:** provider selection (e.g., a Bangladeshi SMS gateway like BulkSMSBD, Alpha SMS, or similar), API key/secret, sender ID
  - **Email:** SMTP settings (host, port, username, password) or a transactional email provider (e.g., Gmail SMTP, SendGrid, Resend) — API key/credentials
- These credentials power all the automated notifications already defined elsewhere in this brief: order confirmation, order status/tracking updates, low-stock alerts, admin new-order notification
- **Security — same rules as the AI API key:** store all credentials encrypted at rest, never expose them client-side, only decrypt server-side when sending a notification
- Include a "Send test SMS/email" button in the admin UI so the admin can verify credentials work before relying on them
- If no gateway is configured yet, the system should fail gracefully (log the intended notification, skip sending, don't crash the order flow) rather than blocking checkout/orders
- Show delivery status/logs (sent/failed) for sent notifications in the admin panel for troubleshooting

## Promo Code / Coupon System
- Add a **Promo Codes** section in the admin panel to create and manage discount codes:
  - Code creation: custom code text (e.g., `ENMAR20`) or auto-generate a random code
  - Discount type: percentage off (e.g., 20%), fixed amount off (e.g., ৳100 off), or free shipping
  - Usage limits: total redemption cap (e.g., first 100 uses), per-customer usage limit (e.g., once per customer), minimum order value to qualify
  - Validity window: start date/time and expiry date/time (auto-deactivates after expiry, no manual cleanup needed)
  - Scope: applicable to all products, specific categories, or specific products only (admin selects)
  - Active/inactive toggle for manual override at any time
- **Checkout integration:** a promo code input field at cart/checkout — validates in real time (valid code, still active, minimum order met, usage limit not exceeded, applicable to items in cart) and shows the discount applied before payment
- **Admin visibility:** list of all promo codes with status (active/expired/exhausted), usage count so far, and total discount amount given — plus a way to see which orders used which code
- One-time link with the Order model: store which promo code (if any) was applied to each order, and the discount amount, for accurate revenue/analytics reporting
- Prevent stacking multiple promo codes on one order unless the admin explicitly wants to allow it (default: one code per order)

## Admin AI Agent (internal automation assistant — distinct from the customer-facing AI)
This is a **separate feature from the customer-facing AI assistant** defined below — do not merge them. This agent lives inside the admin panel only, is used by the admin/staff, and (unlike the customer-facing assistant) is allowed to see admin-side data since it's operated by the store owner, not a customer.

- **Purpose:** help the admin automate and speed up day-to-day store operations, e.g.:
  - Draft/improve product descriptions and SEO meta text from basic input (product name + a few details, or a photo)
  - Summarize sales/analytics trends in plain language ("what sold well this week," "which products are low-margin," etc.) based on the store's real order/product data
  - Draft promotional banner copy, announcement bar text, or social captions for a sale
  - Suggest reorder/restock alerts by analyzing sales velocity vs. current stock
  - Help draft replies to customer support questions (admin reviews/sends, not auto-sent)
  - Assist with bulk product entry (e.g., admin pastes a rough product list, agent structures it into the proper schema for review before saving)
- **Uses the same AI Settings** (API key/provider/model) configured earlier in this brief — one shared AI configuration, but this agent's system prompt/tool access is scoped differently (admin-side) from the customer-facing assistant (customer-side)
- **Action model — read/suggest by default, write only with confirmation:**
  - The agent can freely read admin-side data (products, orders, analytics) to answer questions and generate drafts
  - For anything that changes data (publishing a product, updating a price, sending a customer reply, changing order status), the agent should **propose the change and require explicit admin confirmation** before it's applied — never auto-execute write actions silently
  - Log every action the agent takes (or proposes and admin approves) in an audit trail, distinct from the customer-facing AI's conversation log
- This agent must never be reachable by customers or exposed on the public storefront — it's strictly behind admin authentication
- Keep this agent's scope to assistance/automation of existing admin workflows already defined in this brief — it should not be able to alter site code, change theme/API settings, or perform actions outside the admin panel's defined feature set

## AI Integration Feature (customer-facing assistant, admin-configured)
- Add an **AI Settings** section in the admin panel where the admin can input: AI provider (e.g., Anthropic/OpenAI/etc.), API key, model name, and a system prompt/instructions field
- Once configured, this powers a **customer-facing AI chat assistant** on the storefront (e.g., product Q&A, order status lookup, general help) — this is a support tool for shoppers, not an admin tool
- **API key storage:** encrypted at rest in the database (never in plaintext, never in a `.env` committed to git), only decrypted server-side when calling the AI provider. Never expose the API key to the client/browser under any circumstance
- **Strict data isolation — this is the most important constraint:**
  - The AI must NEVER have access to: the API key itself, other customers' orders/personal data, admin credentials, internal cost/margin data, inventory purchase prices, admin panel analytics, or any backend configuration
  - The AI may ONLY access: public product catalog data, and — when the chat is tied to a logged-in, authenticated session — that specific customer's OWN order history/tracking status (nothing beyond their own account's scope)
  - Build the AI's context/tool access as an explicit allowlist (specific scoped queries/functions), not a general database connection — the AI should never be able to run arbitrary queries
  - System prompt sent to the AI must explicitly instruct it to refuse any request for internal/admin/other-customer information, and this must be enforced server-side (in the code, not just via the prompt) since a customer could try to manipulate the AI into leaking data
  - Log AI conversations for admin review (moderation/abuse monitoring) but do not let the AI itself surface this log data back to customers
- Admin panel should show AI usage/cost tracking (token usage, request count) so the admin can monitor spend
- If the AI provider API call fails, fail gracefully with a normal "chat unavailable, contact us via WhatsApp" message — never expose error details or stack traces to the customer

## Automation Requirements
- Auto order confirmation email/SMS on successful payment
- Auto admin notification (email or webhook) on new order
- Auto low-stock alert to admin
- Auto invoice PDF generation per order
- SSLCommerz payment webhook auto-updates order status (no manual reconciliation)
- Order tracking status changes trigger customer notifications automatically (see Order Tracking System above)

## Branding
- Logo file: provided at `/assets/logo` — earthy brown + botanical monogram
- Derive Tailwind theme (primary/secondary/accent/background) from logo colors
- Typography: warm, premium-organic feel — suggest 1-2 Google Fonts pairings for heading/body, avoid generic corporate fonts
- Product photography style: authentic/earthy, not generic stock-photo look

## Provided Separately (not to be invented by the agent)
- Logo file
- Product list (names, prices, initial stock) as CSV
- Trade license / business documents for SSLCommerz merchant registration (already in hand)
- Domain name (to be purchased)

## Build Order (execute in phases — do not attempt everything in one pass)
1. Scaffold Next.js project + full DB schema (all categories + order tracking fields from day one) + admin auth
2. Build admin panel first (product/order/inventory CRUD + order status control) so real products and test orders can be entered early
3. Build customer-facing pages (homepage → listing → product detail → cart → checkout)
4. Build the order tracking page (customer-facing timeline view) wired to the admin status updates
5. Integrate SSLCommerz in sandbox mode, verify full payment flow for bKash/Nagad/card + COD
6. Add automation layer (emails/SMS, invoice PDF, notifications)
7. Bilingual (Bengali/English) pass
8. Deploy to staging, full end-to-end test, then go live

## Codebase Hygiene
- After scaffolding and at the end of each build phase, remove unused boilerplate files, unused example/demo components, unused dependencies, and dead code — the repo should only contain files actually used by the project
- Do not leave placeholder/starter-template pages (e.g., default Next.js example page, unused sample API routes) in the final codebase
- Keep the folder structure clean and logically organized (e.g., `/app`, `/components`, `/lib`, `/prisma`, `/public`) — no stray or duplicate folders from re-scaffolding attempts
- Before deleting any file, confirm it's genuinely unused (not dynamically imported) to avoid breaking the build

## Guardrails
- Ask for explicit confirmation before: switching payment gateway from sandbox to live mode, running destructive database migrations after real data exists, deploying to production, or activating the AI assistant on the live storefront
- The AI integration feature's data-isolation rules (above) are non-negotiable — if there's ever a tradeoff between AI feature convenience and admin-data exposure risk, choose the safer/more restrictive option and flag it for review
- Keep the codebase clean, commented, and modular — the project owner is learning full-stack development and will read/extend this code themselves
- Prioritize working end-to-end flows over visual polish in early phases; refine design once core flow works
- Do not fabricate business data (prices, product details, license numbers) — leave placeholders clearly marked `TODO` where real data is required from the project owner
