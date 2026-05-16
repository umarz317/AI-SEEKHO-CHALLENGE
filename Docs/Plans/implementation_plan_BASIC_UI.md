# AISEEKHO Mobile App — Implementation Plan

Translate the HTML prototype (`aiseekho-standalone.html`) into the existing **Expo / React Native** app using **Expo Router**.
Match the same design tokens and 6-screen flow, but wire the demo path to the live backend orchestration response instead of static `MDATA` only.

---

## Proposed Changes

### 1 · Dependencies to install

```bash
npx expo install react-native-screens react-native-safe-area-context \
  react-native-gesture-handler react-native-svg expo-font
```

No extra icon libs — we replicate the SVG icon system using `react-native-svg`
which is already present in the current app dependencies.

---

### 2 · File structure

```
mobile-app/
├── package.json                    ← main is expo-router/entry
├── app/
│   ├── _layout.js                  ← Expo Router Stack configuration
│   ├── index.js                    ← Screen 1
│   ├── loading.js                  ← Screen 2
│   ├── understanding.js            ← Screen 3 / Review request
│   ├── recommendation.js           ← Screen 4 / Best match
│   ├── booking.js                  ← Screen 5 / Booking confirmed
│   └── dev/
│       └── trace.js                ← Hidden reviewer trace route
├── src/
│   ├── theme.js                    ← design tokens (M object) + typography
│   ├── data.js                     ← CATEGORIES, EXAMPLES, fallback demo constants
│   ├── api.js                      ← backend client for POST /api/orchestrate and trace/booking reads
│   ├── components/
│   │   ├── Ic.js                   ← SVG icon component (react-native-svg)
│   │   ├── Avatar.js
│   │   ├── MCard.js
│   │   ├── Pill.js
│   │   ├── Buttons.js              ← FilledBtn, AccentBtn, OutlinedBtn
│   │   ├── TopBar.js
│   │   └── BottomNav.js
│   └── state/
│       └── bookingFlow.js          ← shared flow state from backend response
```

---

### 3 · Navigation

Use the existing **Expo Router** setup. `mobile-app/package.json` already points to `expo-router/entry`, and `mobile-app/app/_layout.js` owns the Stack configuration with `headerShown: false`.

Keep the exact customer flow:

```
Home → Loading → Review request → Loading → Best match → Loading → Booking confirmed → Booking status
                      ↑ back                         ↑ back                       ↑ back
```

Loading screen auto-advances after 6 steps (460ms/step, same timing as prototype).
The technical trace is not part of the normal customer flow. Put it behind `/dev/trace` or an explicit reviewer link.

---

### 4 · Screens summary

| # | Screen | Key elements |
|---|---|---|
| 1 | **Home** | Greeting, hero textarea, language detection, city picker, category chips, example queries, AccentBtn |
| 2 | **Loading** | Animated conic-gradient orb (Animated API), step progress list, progress bar |
| 3 | **Understanding** | Query bubble, confidence ring SVG, 5 detail rows, AI note banner |
| 4 | **Recommendation** | Provider hero card, stats grid, reasons pills, match score footer, alternatives |
| 5 | **Booking** | Success checkmark animation, booking details, reminder pill, agent checklist |
| 6 | **Hidden reviewer trace** | Dark header card, 6-step timeline with connector lines, accessible only through `/dev/trace` or reviewer link |

---

### 5 · Design tokens (`src/theme.js`)

Direct port of the `M` object from the prototype — same hex values, same naming.

### 6 · Icon system (`src/components/Ic.js`)

Port the SVG path data using `react-native-svg` (`Svg`, `Path`, `Circle`, etc.)
instead of the browser `<svg>` element. Same icon names, same API.

---

## Open Questions

> [!IMPORTANT]
> **Loading animation**: The conic-gradient spinner uses CSS — RN needs `Animated` + `react-native-svg` or a Lottie file. The orb will be approximated with a rotating arc. Is that acceptable, or do you want a Lottie animation?

> [!NOTE]
> **Fonts**: `Plus Jakarta Sans` requires `expo-font` + `useFonts`. Will be added. App will show system fallback until fonts load.

---

## Verification Plan

1. Run `npx expo start --web` to do a quick visual check in browser
2. Check all 6 screens navigate correctly end-to-end
3. Verify loading auto-advances and back navigation works
4. Verify the primary mobile demo calls `POST /api/orchestrate` and renders request understanding, recommendation, booking, reminder, and trace summary from the backend response
5. Verify fallback demo constants are only used when the backend is unavailable, and the UI clearly stays customer-facing
6. Verify the technical trace is hidden from normal customer navigation and reachable only by `/dev/trace` or reviewer link
