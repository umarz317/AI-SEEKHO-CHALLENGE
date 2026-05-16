# AISEEKHO Mobile App — Implementation Plan

Translate the HTML prototype (`aiseekho-standalone.html`) into a native **Expo / React Native** app
pixel-for-pixel, using the same design tokens, mock data, and 6-screen flow.

---

## Proposed Changes

### 1 · Dependencies to install

```bash
npx expo install @react-navigation/native @react-navigation/stack \
  react-native-screens react-native-safe-area-context \
  react-native-gesture-handler
```

No extra icon libs — we replicate the SVG icon system using `react-native-svg`
(already included with Expo).

---

### 2 · File structure

```
mobile-app/
├── App.js                          ← navigation root (Stack navigator)
├── src/
│   ├── theme.js                    ← design tokens (M object) + typography
│   ├── data.js                     ← MDATA, CATEGORIES, EXAMPLES constants
│   ├── components/
│   │   ├── Ic.js                   ← SVG icon component (react-native-svg)
│   │   ├── Avatar.js
│   │   ├── MCard.js
│   │   ├── Pill.js
│   │   ├── Buttons.js              ← FilledBtn, AccentBtn, OutlinedBtn
│   │   ├── TopBar.js
│   │   └── BottomNav.js
│   └── screens/
│       ├── HomeScreen.js           ← Screen 1
│       ├── LoadingScreen.js        ← Screen 2 (AI orb + step list)
│       ├── UnderstandingScreen.js  ← Screen 3
│       ├── RecommendationScreen.js ← Screen 4
│       ├── BookingScreen.js        ← Screen 5
│       └── TraceScreen.js          ← Screen 6
```

---

### 3 · Navigation

Use a **Stack navigator** with `headerShown: false` (custom `TopBar` component
handles back + title), matching the exact screen flow:

```
Home → Loading → Understanding → Loading → Recommendation → Loading → Booking → Trace
                      ↑ back                      ↑ back                  ↑ back
```

Loading screen auto-advances after 6 steps (460ms/step, same timing as prototype).

---

### 4 · Screens summary

| # | Screen | Key elements |
|---|---|---|
| 1 | **Home** | Greeting, hero textarea, language detection, city picker, category chips, example queries, AccentBtn |
| 2 | **Loading** | Animated conic-gradient orb (Animated API), step progress list, progress bar |
| 3 | **Understanding** | Query bubble, confidence ring SVG, 5 detail rows, AI note banner |
| 4 | **Recommendation** | Provider hero card, stats grid, reasons pills, match score footer, alternatives |
| 5 | **Booking** | Success checkmark animation, booking details, reminder pill, agent checklist |
| 6 | **Trace** | Dark header card, 6-step timeline with connector lines |

---

### 5 · Design tokens (`src/theme.js`)

Direct port of the `M` object from the prototype — same hex values, same naming.

### 6 · Icon system (`src/components/Ic.js`)

Port the SVG path data using `react-native-svg` (`Svg`, `Path`, `Circle`, etc.)
instead of the browser `<svg>` element. Same icon names, same API.

---

## Open Questions

> [!IMPORTANT]
> **Navigation**: Stack navigator is proposed. Would you prefer **expo-router** (file-based routing) instead? It's the newer Expo default.

> [!IMPORTANT]
> **Loading animation**: The conic-gradient spinner uses CSS — RN needs `Animated` + `react-native-svg` or a Lottie file. The orb will be approximated with a rotating arc. Is that acceptable, or do you want a Lottie animation?

> [!NOTE]
> **Fonts**: `Plus Jakarta Sans` requires `expo-font` + `useFonts`. Will be added. App will show system fallback until fonts load.

---

## Verification Plan

1. Run `npx expo start --web` to do a quick visual check in browser
2. Check all 6 screens navigate correctly end-to-end
3. Verify loading auto-advances and back navigation works
