---
name: Kinetic Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed01b'
  on-secondary-container: '#6f5900'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffe083'
  secondary-fixed-dim: '#eec200'
  on-secondary-fixed: '#231b00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  container-max: 1920px
---

## Brand & Style

The design system is engineered for a high-stakes Enterprise SaaS environment, blending the precision of data science with a futuristic, premium aesthetic. It targets decision-makers who require clarity amidst complexity, evoking an emotional response of total control, advanced intelligence, and uncompromising security.

The style is a hybrid of **Futuristic Glassmorphism** and **Corporate Modernism**. It utilizes deep layers of transparency and high-performance blur effects to create a sense of physical depth within a digital space. In light mode, the system feels like a high-end architectural studio—airy, professional, and precise. In dark mode, it transforms into a tactical command center—high-contrast, data-centric, and energetic, utilizing glowing accents to highlight critical insights.

## Colors

This design system utilizes a dynamic color strategy that pivots based on the user's environment to maintain a "premium-tech" feel.

- **Light Mode (Default):** Focuses on "Emerald Trust." The primary accent is Emerald Green (#10b981), conveying growth and stability. Backgrounds utilize pure white for clarity and #F8FAFC for subtle surface separation.
- **Dark Mode:** Transitions to "Cybernetic Focus." The background shifts to Deep Black (#000000), using a Glowing Cyberpunk Yellow (#facc15) as the primary accent. This high-contrast pairing ensures data points pop against the void, reducing eye strain during long analytical sessions.
- **Functional Colors:** Success is tied to the Emerald palette, Warning to the Yellow palette, and Error to a sharp, high-chroma Red (#ef4444) to ensure instant recognition in high-security feeds.

## Typography

The typography system prioritizes legibility and technical sophistication. **Inter** is the workhorse font for all interface elements, chosen for its neutral tone and exceptional performance at small sizes. For data-heavy displays, technical labels, and monospaced values, **Geist** is introduced to provide a "developer-friendly" and precise character.

- **Scale:** High contrast between display titles and body text creates a clear hierarchy.
- **Data-Centricity:** Monospaced numerals are used for all KPI values to prevent "jumping" during real-time data updates.
- **Case Styling:** Labels and category headers should use uppercase with slight letter spacing to reinforce the professional, institutional feel.

## Layout & Spacing

This design system uses a **Fluid Grid** model optimized for high-resolution displays (1440p to 4K). 

- **The Grid:** A 12-column system with wide 24px gutters to allow the glassmorphic elements "room to breathe."
- **Sidebars:** A sleek, fixed-width sidebar (280px) provides persistent navigation. In widescreen formats, a secondary "Context Panel" can be anchored to the right.
- **Spacing Rhythm:** Based on a 4px base unit. Component padding should lean towards being generous (e.g., 24px or 32px for card internals) to maintain a premium, uncluttered feel.
- **Breakpoints:**
  - Desktop (Large): 1440px+ (Full 12-column dashboard)
  - Tablet: 768px - 1439px (Sidebar collapses to icons, 8-column grid)
  - Mobile: < 767px (Single column flow, sticky bottom navigation)

## Elevation & Depth

Depth is the defining characteristic of this system, achieved through **Glassmorphism** rather than traditional drop shadows.

- **The Glass Recipe:** Surfaces utilize a 20px backdrop blur. 
  - *Light Mode:* White frosting at 70% opacity with a 1px solid white border at 20% opacity.
  - *Dark Mode:* Black frosting at 60% opacity with a 1px border using the accent color (Yellow) at 10% opacity.
- **Z-Axis Hierarchy:**
  - **Level 0 (Canvas):** The base background (#FFFFFF or #000000).
  - **Level 1 (Cards):** Frosted glass containers for data visualizations and lists.
  - **Level 2 (Modals/Popovers):** Increased blur (40px) and a subtle outer glow that matches the primary accent color to simulate light emission.

## Shapes

The shape language balances geometric precision with modern softness.

- **Containers:** KPI cards and data containers use a **0.5rem (8px)** corner radius to maintain a professional, structural appearance.
- **Interactive Elements:** Buttons, tags, and active state indicators use **Pill-shaped (Full-round)** geometry. This contrast between the structured cards and organic buttons makes interactive areas immediately identifiable.
- **Inputs:** Text fields and dropdowns follow the container's 8px radius for a unified form-factor.

## Components

- **Buttons:** Primary buttons are pill-shaped. In Dark Mode, they feature a "Neon Glow" box-shadow using the secondary accent color. In Light Mode, they use a solid Emerald fill with a subtle inner-light bevel.
- **KPI Cards:** These are the hero components. They must feature a frosted background, a monospaced trend indicator (up/down), and an integrated Sparkline (ECharts) that uses the primary accent color.
- **Sidebar:** A translucent, vertical blur-bar. Icons should be "Duotone" style, using the primary accent for the secondary path.
- **High-Security Alert Feed:** Alerts should not just change color but change the "Glow" intensity of their glass border. A critical alert in dark mode should pulse with a soft red outer glow.
- **Sticky Headers:** Always frosted. As content scrolls beneath, the 20px blur should create a beautiful "color-melt" effect, maintaining readability while showing the richness of the data beneath.
- **Active States:** Active navigation or selection is indicated by a pill-shaped "blob" behind the text, utilizing 10% opacity of the accent color.