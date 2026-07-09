---
name: Heritage & Heart
colors:
  surface: '#fff8f4'
  surface-dim: '#e1d8d2'
  surface-bright: '#fff8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2eb'
  surface-container: '#f5ece5'
  surface-container-high: '#f0e7df'
  surface-container-highest: '#eae1da'
  on-surface: '#1f1b17'
  on-surface-variant: '#434842'
  inverse-surface: '#34302b'
  inverse-on-surface: '#f8efe8'
  outline: '#737971'
  outline-variant: '#c3c8bf'
  surface-tint: '#4a654d'
  primary: '#47614a'
  on-primary: '#ffffff'
  primary-container: '#5f7a61'
  on-primary-container: '#efffec'
  inverse-primary: '#b1ceb1'
  secondary: '#8c4e2e'
  on-secondary: '#ffffff'
  secondary-container: '#feae87'
  on-secondary-container: '#793f21'
  tertiary: '#5c5b56'
  on-tertiary: '#ffffff'
  tertiary-container: '#74736e'
  on-tertiary-container: '#fdfaf3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cceacc'
  primary-fixed-dim: '#b1ceb1'
  on-primary-fixed: '#07200e'
  on-primary-fixed-variant: '#334d36'
  secondary-fixed: '#ffdbcb'
  secondary-fixed-dim: '#ffb692'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#6f3819'
  tertiary-fixed: '#e5e2db'
  tertiary-fixed-dim: '#c9c6c0'
  on-tertiary-fixed: '#1c1c18'
  on-tertiary-fixed-variant: '#474742'
  background: '#fff8f4'
  on-background: '#1f1b17'
  surface-variant: '#eae1da'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  caption:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is centered on the concept of a "Digital Family Heirloom." It prioritizes emotional safety, nostalgia, and intergenerational accessibility. The brand personality is nurturing, dependable, and quietly joyful, functioning as a calm backdrop for precious family media.

The visual style is **Modern Tactile**. It blends the cleanliness of modern SaaS with the warmth of a physical photo album. Key characteristics include:
- **Softness:** Eschewing harsh lines in favor of generous radii and organic transitions.
- **Nostalgia:** Utilizing editorial typography to evoke the feeling of a published book or a curated scrapbook.
- **Clarity:** A "safety-first" UI approach with high-legibility targets and obvious interaction cues, ensuring users from young children to grandparents feel confident navigating the space.

## Colors

The palette is inspired by natural materials and vintage paper. 

- **Primary (Sage Green):** Represents growth and stability. Used for primary actions and "safe" navigation elements.
- **Secondary (Terracotta):** Adds a touch of human warmth and energy. Used for celebratory actions, notifications, and accents that draw the eye to shared memories.
- **Tertiary (Cream/Paper):** The primary surface color. It is softer on the eyes than pure white, reducing glare for older users and providing a physical "paper" feel.
- **Neutral (Charcoal Earth):** Used for typography to ensure high contrast against the cream background while remaining softer than pure black.

All color combinations must pass WCAG AA standards for contrast, particularly for text and essential iconography.

## Typography

This design system uses a pairing of **Source Serif 4** and **Be Vietnam Pro**. 

- **Source Serif 4** is used for headlines. Its sturdy, traditional character conveys authority and the "scrapbook" aesthetic. It should be used for page titles, memory dates, and album names.
- **Be Vietnam Pro** is the workhorse for body copy and interface labels. Its contemporary, open apertures and friendly curves ensure high legibility on mobile devices and comfort for long-form captions.

**Accessibility Note:** Line heights are kept generous (minimum 1.6 for body) to assist users with visual impairments or reading difficulties.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. While the central content container is capped for readability, the internal grid is fluid to accommodate varying photo aspect ratios.

- **Grid:** A 12-column grid for desktop, 6-column for tablet, and 2-column for mobile.
- **Spacing Rhythm:** Based on an 8px base unit. Generous margins (40px on desktop) are used to create "breathing room," reinforcing the calm and premium feel of a photo gallery.
- **Reflow:** On mobile, complex grid layouts collapse into a single vertical stream ("The Memory Stream") to ensure interaction targets (like 'Like' or 'Comment') remain large and tappable.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Ambient Shadows**. 

- **Level 0 (Background):** The base `background_hex` cream color.
- **Level 1 (Cards/Containers):** Pure white surfaces with a very soft, diffused shadow (12% opacity, 16px blur) to make photos pop without looking "techy."
- **Level 2 (Modals/Overlays):** Elevated with a slightly tighter, darker shadow to indicate focus. 

Avoid harsh borders. Instead, use subtle shifts in background color (`tertiary_color_hex`) to define sections like sidebars or comment areas.

## Shapes

The shape language is consistently **Rounded**. 

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) radius.
- **Large Containers:** Photo thumbnails and main content cards use a 1rem (16px) radius to emphasize the "soft" brand personality.
- **Interactive Icons:** Utilize circular backgrounds for hover states to maintain the friendly, organic feel.

## Components

### Buttons
Primary buttons use the Sage Green background with white text. They should have a minimum height of 48px to be easily tappable by all age groups. Use "Soft" rounding (8px).

### Cards (The "Memory" Card)
This is the core component. It must feature a generous 16px padding, a 16px corner radius, and include a dedicated area for "Storytelling" (captions) using `body-md` typography.

### Input Fields
Inputs should have a light cream background and a 2px border on focus using the Primary color. Place labels clearly above the field (never just as placeholder text) for cognitive clarity.

### Chips/Tags
Used for family members' names or "Year" tags. These should use the Terracotta secondary color at low opacity (10-15%) with dark text to remain prominent but not distracting from the photos.

### Navigation
A bottom navigation bar is preferred for mobile to keep controls within thumb-reach, using clear icon+label pairings. On desktop, a simple top-aligned bar preserves the "gallery" focus.