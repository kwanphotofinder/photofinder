# PhotoFinder UI Design Guide

This document is the shared UI source of truth for the Student, Photographer, and Admin experiences. It defines the visual system, layout rules, component behavior, responsive expectations, and release checks for frontend changes.

## 1. Product Character

PhotoFinder is an operational product, not a marketing site. Users repeatedly upload, search, review, save, and manage photos. The interface should therefore feel:

- Clean and calm rather than decorative.
- Dense enough for scanning, with clear grouping and hierarchy.
- Consistent across roles while adapting to each workflow.
- Direct: every visible action should have a clear purpose.
- Trustworthy when handling identity, facial data, downloads, and deletion.

Prefer useful structure over visual effects. Avoid gradients, floating blobs, oversized hero copy, excessive shadows, nested cards, and decorative elements that compete with the task.

## 2. Design Tokens

Use the existing tokens in `app/globals.css` before adding page-specific values.

| Purpose | Preferred token or class |
| --- | --- |
| Primary accent | `#82181a`, `bg-primary`, `text-primary` |
| Primary hover | `#641416` or the existing darker primary value |
| Page background | `bg-background` or `bg-slate-50` |
| Surface | `bg-card` or `bg-white` |
| Border | `border-border` or `border-slate-200` |
| Secondary text | `text-muted-foreground` |
| Success | Emerald tokens/classes |
| Warning | Amber tokens/classes |
| Error or destructive | `text-destructive`, `bg-destructive`, or red status classes |

Rules:

- Reuse a token when the meaning is already represented by the theme.
- Do not introduce a new hex color for a one-off component.
- Use color to communicate state, hierarchy, or action, not as decoration.
- Keep contrast sufficient for text, icons, controls, and status badges.
- Use maroon as an accent; do not make every surface maroon.

## 3. Typography

Typography is defined by `app/layout.tsx` and `app/globals.css`.

- Use the existing font variables and Tailwind theme.
- Use bold or semibold headings with compact line height.
- Keep labels and metadata smaller than primary content.
- Use uppercase and letter spacing sparingly; Thai text should not be forced into excessive tracking.
- Keep button labels short, specific, and action-oriented.
- Avoid large display text inside compact cards, dialogs, or dashboards.
- Make long Thai and English labels wrap instead of causing horizontal overflow.

Recommended hierarchy:

- Page title: `text-3xl` to `text-4xl`, depending on viewport and page importance.
- Section title: `text-2xl` to `text-3xl`.
- Card title: `text-sm` to `text-lg`.
- Metadata and helper text: `text-xs` to `text-sm`.

## 4. Layout System

Use the existing page shell patterns:

```text
Header
Main page background
	Constrained content: max-w-7xl
		Section or surface
```

Preferred spacing and width classes:

- Page width: `max-w-7xl mx-auto`.
- Horizontal padding: `px-4 sm:px-6 lg:px-8`.
- Comfortable vertical sections: `py-8` to `py-12`.
- Compact operational sections: `py-4` to `py-8`.
- Use `gap-3` or `gap-4` for repeated controls and cards.

Layout rules:

- Use a two-column layout only when the columns represent clearly different content groups.
- Stack columns on mobile.
- Keep the primary task near the top of the page.
- Use section headers with a title and only the action relevant to that section.
- Do not repeat the same action in the hero, empty state, and section header.
- Do not create a card inside another card unless the inner block is a meaningful sub-tool.

## 5. Surfaces and Shape

Standard repeated cards should normally use:

```text
bg-white border border-slate-200 rounded shadow-none
```

Use a light shadow only when the surface needs separation from the page. Hover states should change the border, background, or a small shadow; they should not cause layout shift.

Radius guidance:

- `rounded` for dense admin and photographer surfaces.
- `rounded-lg` for standard grouped content.
- `rounded-xl` or `rounded-2xl` only for prominent media such as selfie previews or intentional feature surfaces.
- Keep buttons, cards, and dialogs visually consistent within the same page.

## 6. Shared Components

### Header and Navigation

Use `components/header.tsx` and `components/navigation.tsx`.

- Show role-appropriate navigation only.
- Keep the logo, language switcher, user menu, and logout behavior consistent.
- Make navigation usable at narrow widths; hide secondary labels when necessary but preserve icons and accessible names.
- Use the active state to identify the current page without adding unnecessary decoration.
- Do not create page-specific headers unless the shared header cannot represent the workflow.

### Buttons

- Primary button: the main action for the current surface.
- Outline button: secondary or alternative action.
- Ghost button: low-emphasis navigation or utility action.
- Destructive button: delete, remove, or irreversible action only.
- Icon-only button: use for familiar controls such as zoom, close, download, favorite, or fullscreen; provide `title` or an accessible label.
- Disable controls during async operations and show a spinner where useful.
- Never place two identical primary actions in the same visual area.

### Dialogs and Modals

- Keep the main content focused and the action area compact.
- Use consistent close behavior and preserve keyboard access.
- On mobile, use adequate edge padding and avoid content touching the viewport edges.
- Keep media within `max-width` and `max-height`; preserve its aspect ratio.
- Place related actions in one toolbar or grouped action row.
- Destructive requests should explain the consequence before confirmation.

## 7. Role-Specific Patterns

### Student

The Student UI shares the clean utility language of the Admin and Photographer UIs, with emphasis on personal photo discovery.

- Use a balanced two-column hero on desktop and a single column on mobile.
- Keep the Student space intro concise and place the selfie status beside it.
- Show the selfie setup or update action in one primary location only.
- Make the selfie preview responsive: smaller on mobile, larger on desktop, with a clear status indicator.
- Use `PhotoGrid` for matched photos and Favorites.
- Use short, helpful empty states that explain what is happening and what the user should expect next.
- Avoid duplicate labels such as a collection eyebrow immediately above the same section title.

### Photographer

- Prioritize event selection, folder/file upload, queue status, processing, and notification workflows.
- Keep upload controls and the staged queue visible together on desktop.
- Use compact rows, status badges, progress indicators, and clear error states.
- Avoid decorative artwork that reduces room for filenames, progress, or controls.

### Admin

- Prioritize high-volume review and management tasks.
- Use tabs, tables, filters, compact cards, and dense but readable rows.
- Use status colors consistently for moderation, processing, requests, and system health.
- Require confirmation before destructive operations affecting real data.
- Keep controls aligned and predictable across management sections.

## 8. Photo Experiences

### PhotoGrid

Use `components/photo-grid.tsx` for repeated photo listings.

- Use stable aspect ratios so cards do not resize as content loads.
- Use responsive columns; reduce columns on narrow screens.
- Keep image metadata below or over the image in a consistent location.
- Favorite state must be visible and must use the API helpers in `lib/api-client.ts`.
- Prevent duplicate requests while a save or remove action is pending.
- Keep download, view, share, and remove actions distinct.

### Photo Detail Modal

Use `components/photo-detail-modal.tsx` for the detail view.

- Make the image the primary visual focus.
- Keep zoom, fullscreen, close, favorite, share, and download controls discoverable.
- Keep the action toolbar compact and balanced on mobile.
- Original download must be clearly separate from a watermarked download.
- Fullscreen viewing must preserve the image aspect ratio and provide breathing room around the image.
- Removal requests must explain the review process and any group-photo behavior.

## 9. Responsive Behavior

Validate at least:

- Mobile: 360-430px.
- Tablet: approximately 768px.
- Desktop: 1280px and wider.

Required checks:

- No horizontal page or dialog overflow.
- No button collision, clipped label, or accidental layout shift.
- Header controls remain reachable and understandable.
- Navigation labels may collapse, but icons and accessible names remain.
- Grid columns reduce with viewport width.
- Images use stable dimensions and preserve aspect ratio.
- Dialogs have viewport-safe padding and scroll internally when content is long.
- Long event names, filenames, Thai text, and translated labels wrap safely.
- Touch targets are large enough for mobile use.

## 10. Localization

All user-facing text must support the existing language system.

- Use `useLanguage()` and `t("key")` in client components.
- Do not hardcode translatable English text in JSX.
- Add both `th` and `en` values for every new key in `lib/language-context.tsx`.
- Thai mode should be Thai-first; retain English only for brands or necessary technical terms.
- Keep equivalent labels consistent across Student, Photographer, and Admin surfaces.
- Translate loading, empty, error, confirmation, and destructive messages, not only headings and buttons.
- Check translated text at mobile widths because Thai and English have different line lengths.

## 11. Accessibility and Trust

- Use semantic headings in order.
- Provide meaningful `alt` text for photos and avatars.
- Give icon-only controls a `title`, `aria-label`, or equivalent accessible name.
- Preserve keyboard focus and close behavior in dialogs and menus.
- Do not communicate state by color alone; include text or an icon with an accessible name.
- Make destructive actions explicit and confirm irreversible operations.
- Never display or log raw images, facial embeddings, authentication tokens, or secrets unnecessarily.

## 12. Loading, Empty, and Error States

Every data-driven surface should define all three states:

- Loading: show a compact spinner or skeleton without shifting the page structure.
- Empty: explain why the area is empty and what the user can expect next.
- Error: state that the operation failed and provide a practical retry or recovery path.

Keep these states visually consistent with the surrounding surface. Do not use vague decorative text as the only empty-state explanation.

## 13. Implementation Rules

- Reuse existing components in `components/` and `components/ui/` before adding new primitives.
- Reuse helpers in `lib/` for API calls, downloads, sharing, language, and engagement tracking.
- Keep API route handlers thin and keep UI changes scoped to the owning component.
- Avoid unrelated dependency upgrades, generated-file churn, and broad refactors.
- Keep comments brief and only add them when the code is not self-explanatory.

## 14. Pre-Release Checklist

Before merging a UI change:

- [ ] The correct shared component and design tokens are reused.
- [ ] The primary action appears once per visual area.
- [ ] Student, Photographer, and Admin surfaces remain visually coherent.
- [ ] Mobile and desktop layouts were checked.
- [ ] Loading, empty, error, and async-disabled states work.
- [ ] Thai and English translations exist for all new visible text.
- [ ] Images, dialogs, and cards preserve stable dimensions and aspect ratio.
- [ ] Accessibility labels and destructive confirmations are present.
- [ ] `get_errors` or the relevant type/lint check passes.
- [ ] Docker is rebuilt and the web endpoint responds when UI behavior changes.
- [ ] `git diff --check` passes before commit.
