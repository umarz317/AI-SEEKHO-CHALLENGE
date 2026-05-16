# Goal Description
Build a mock-first, Google-service-compatible agentic service orchestration prototype for the informal economy. The system will parse natural language requests, resolve locations, discover and rank providers, simulate booking, schedule reminders, and log trace events.

## User Review Required

> [!WARNING]
> **Mock-First Strategy:** The default mode uses deterministic mock adapters for all core services to ensure stable demos. Google Service adapters will be built as swappable stubs behind environment variables.
> **Implementation Hold:** Noted that this plan is for documentation only at this stage; no code generation or implementation will proceed until you authorize it.

## Proposed Architecture

### Environment Switches
Control modes via `.env`:
```env
APP_MODE=demo
INTENT_MODE=mock # mock | google | hybrid
LOCATION_MODE=mock
PROVIDER_MODE=mock
DISTANCE_MODE=mock
BOOKING_STORE_MODE=local
NOTIFICATION_MODE=mock
REMINDER_MODE=mock
```

### Ranking Logic & Reason Codes
Formula: `score = 0.30 * availabilityScore + 0.25 * ratingScore + 0.20 * distanceScore + 0.15 * reliabilityScore + 0.10 * responseScore`
Reason codes: `available_in_requested_window`, `closest_available_provider`, `high_rating`, `high_completed_jobs`, `fast_response_rate`, `outside_requested_time`, `too_far`, `category_mismatch`.

## Detailed Agent Input/Output Contracts
The OrchestratorAgent calls these in sequence:

1. **IntentUnderstandingAgent**
   - Output: `{"serviceType": "AC Technician", "normalizedServiceType": "ac_technician", "locationText": "G-13", "city": "Islamabad", "dateText": "kal", "resolvedDate": "2026-05-17", "timeText": "subah", "timeWindow": {"start": "09:00", "end": "12:00"}, "detectedLanguage": "roman_urdu", "confidence": 0.94}`
2. **LocationResolutionAgent**
   - Output: `{"locationText": "G-13", "formattedLocation": "G-13, Islamabad", "lat": 33.6469, "lng": 72.9615, "source": "mock"}`
3. **ProviderDiscoveryAgent**
   - Output: `{"providers": [{"id": "p_001", "name": "Ali AC Services", "category": "ac_technician", "lat": 33.6602, "lng": 72.9811, "rating": 4.8, "completedJobs": 312, "responseRate": 0.96, "availableSlots": ["2026-05-17T10:00:00+05:00"]}], "source": "mock"}`
4. **ProviderRankingAgent**
   - Output: `{"rankedProviders": [{"providerId": "p_001", "name": "Ali AC Services", "score": 0.913, "distanceKm": 2.1, "availableSlot": "2026-05-17T10:00:00+05:00", "reasonCodes": ["available_in_requested_window", "high_rating", "nearby", "strong_response_rate", "high_completed_jobs"], "explanation": "Selected because the provider is available tomorrow morning, 2.1 km away, rated 4.8, and has strong job history."}]}`
5. **BookingAgent**
   - Output: `{"bookingId": "BK-20260517-001", "status": "confirmed", "providerId": "p_001", "providerName": "Ali AC Services", "slot": "2026-05-17T10:00:00+05:00", "confirmationMessage": "Booking confirmed with Ali AC Services for Sunday, May 17, 2026 at 10:00 AM.", "stateChanged": true}`
6. **FollowUpAgent**
   - Output: `{"reminderId": "REM-BK-20260517-001", "reminderTime": "2026-05-17T09:00:00+05:00", "reminderMessage": "Reminder: Ali AC Services will visit today at 10:00 AM for AC service in G-13.", "completionCheckScheduled": true}`
7. **TraceAgent**
   - Output: `{"traceId": "trace_001", "events": [{"step": 1, "agent": "IntentUnderstandingAgent", "tool": "parse_request", "status": "success", "source": "mock", "summary": "Extracted AC Technician, G-13, tomorrow morning."}]}`

## Detailed API Contracts

### `POST /api/orchestrate`
**Request:**
```json
{
  "userId": "demo-user-001",
  "text": "Mujhe kal subah G-13 mein AC technician chahiye",
  "cityHint": "Islamabad",
  "timezone": "Asia/Karachi"
}
```
**Response:**
```json
{
  "traceId": "trace_001",
  "requestUnderstanding": {
    "serviceType": "AC Technician", "location": "G-13, Islamabad",
    "dateLabel": "Tomorrow", "timeLabel": "Morning",
    "timeWindowLabel": "9:00 AM - 12:00 PM", "detectedLanguage": "Roman Urdu", "confidence": 0.94
  },
  "recommendation": {
    "providerId": "p_001", "providerName": "Ali AC Services", "rating": 4.8,
    "distanceLabel": "2.1 km away", "slotLabel": "10:00 AM", "reason": "Closest available high-rated AC technician."
  },
  "alternatives": [
    {
      "providerId": "p_003", "providerName": "CoolAir Islamabad", "rating": 4.9,
      "distanceLabel": "5.4 km away", "slotLabel": "11:30 AM", "reason": "Higher rating but farther away."
    }
  ],
  "booking": {
    "bookingId": "BK-20260517-001", "status": "confirmed",
    "confirmationMessage": "Booking confirmed with Ali AC Services for 10:00 AM.",
    "reminderMessage": "Reminder scheduled for 9:00 AM."
  },
  "traceSummary": [
    "Intent parsed successfully.", "Location resolved to G-13, Islamabad.", "3 providers found.",
    "Ali AC Services selected.", "Booking confirmed.", "Reminder scheduled."
  ]
}
```

## Mobile-First UI Execution Brief
Build the customer experience as a real mobile app first, with web preview only as a secondary convenience. The customer should never feel they are looking at a hackathon demo, backend console, or trace viewer.

- **Product Positioning:** Production-style local-services mobile app for everyday customers in Pakistan. The app should feel closer to Careem/Uber reliability plus local service booking.
- **Main Navigation:** Home, Bookings, Messages, Profile.
- **Hidden Routes:** `/dev/trace`, `/dev/health`, `/demo-script`.
- **Main Customer Flow:** Home -> Describe service need -> Review request -> Best match -> Book now -> Booking confirmed -> Booking status.
- **Copy Rules:**
  - Say "We understood your request" instead of "Intent parsed successfully."
  - Say "We found the best available match" instead of "ProviderRankingAgent selected provider."
  - Say "Your booking is confirmed" instead of "BookingAgent created booking."
  - Say "Reminder set" instead of "Mock reminder scheduled."
  - Never show Mock Mode, Adapter Mode, MCP, or raw tool names in the main customer UI.
- **Required Mobile Components:** `MobileAppShell`, `BottomTabBar`, `TopGreetingHeader`, `ServiceSearchInput`, `PopularServiceGrid`, `ExampleChipRow`, `StickyBottomAction`, `RequestReviewCard`, `ProviderMatchCard`, `ReasonChip`, `BookingSummaryCard`, `BookingActionGrid`, `BookingActivityTimeline`, `ExpandableMatchDetails`, `LoadingStepSheet`, `EmptyState`, `ErrorState`, `MissingLocationPrompt`, `MissingTimeBottomSheet`.

## Mock Dataset Requirements
The mock data (e.g., `providers.mock.json`) will look exactly like this:
```json
{
  "id": "p_001", "name": "Ali AC Services", "category": "ac_technician", "city": "Islamabad",
  "areasServed": ["G-13", "G-11", "F-10", "F-11"], "lat": 33.6602, "lng": 72.9811,
  "rating": 4.8, "completedJobs": 312, "responseRate": 0.96,
  "verificationStatus": "verified", "priceLevel": "medium",
  "availableSlots": ["2026-05-17T10:00:00+05:00", "2026-05-17T11:30:00+05:00"]
}
```

## Development Milestones
1. **Contracts and mock data:** Shared Zod schemas, mock JSONs.
2. **Agent pipeline:** Orchestrator, all 7 agents, ranking formula.
3. **API layer:** Core endpoints (`/api/orchestrate`, `/api/traces`, `/api/bookings`).
4. **Mobile-first consumer app:** Home, request review, best match, booking confirmation, booking status, booking activity, hidden technical trace.
5. **Antigravity orchestration:** Workflow files, MCP tool bridge.
6. **Google adapter stubs:** Environment-flagged integrations for Gemini, Places, Routes, Firebase.

## Proposed Changes
Using a `pnpm` workspace setup, targeting existing directories.

#### [NEW] [pnpm-workspace.yaml](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/pnpm-workspace.yaml)
#### [NEW] [package.json](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/package.json)
#### [NEW] [packages/contracts/src/request.schema.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/packages/contracts/src/request.schema.ts)
*(and other schema files: provider, booking, trace, api-response)*

### API Backend (`backend/`)
#### [NEW] [server.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/backend/src/server.ts)
#### [NEW] [routes/orchestrate.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/backend/src/routes/orchestrate.ts)
#### [NEW] [agents/orchestrator.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/backend/src/agents/orchestrator.ts)
*(plus 7 specialized agents: intent, location, discovery, ranking, booking, followup, trace)*
#### [NEW] [tools/intent/index.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/backend/src/tools/intent/index.ts)
*(plus tools for location, providers, distance, booking, notification, reminder)*

### Mobile App (`mobile-app/`)
#### [NEW] [app/index.tsx](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/mobile-app/app/index.tsx)
*(plus request, understanding, recommendation, booking, and trace screens)*

### Web App (`web-app/`)
*(Stub layout and page components)*

### MCP Server Bridge (`mcp-server/`)
#### [NEW] [index.ts](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/mcp-server/src/index.ts)
*(plus the 8 tools like parse-request, resolve-location, rank-providers, etc.)*

### Documentation & Workflows
#### [NEW] [docs/design-agent-brief.md](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/docs/design-agent-brief.md)
*(plus architecture.md, api-contracts.md, agent-trace-format.md)*
#### [NEW] [antigravity/workflows/service-booking-demo.md](file:///Users/umar/Documents/AI-SEEKHO-CHALLENGE/antigravity/workflows/service-booking-demo.md)

## Verification Plan
1. **Case 1:** *Mujhe kal subah G-13 mein AC technician chahiye* -> Select Ali AC Services, confirm 10:00 AM booking.
2. **Case 2:** *Need plumber in F-10 today evening* -> Parse English, rank available plumbers.
3. **Case 3:** *مجھے آج شام الیکٹریشن چاہیے* -> Parse Urdu, ask/infer location based on city hint.
4. **Case 4:** *Need electrician today* -> Return missing location state.
5. **Case 5:** *Need beautician in F-11* -> Return missing time state.
6. **Case 6:** Closest provider unavailable -> Rank available provider above closest unavailable.
7. **Case 7:** No exact category match -> Show fallback suggestions and trace mismatch.

## Evaluation Mapping
- **Google Antigravity (25%):** Uses workflows, MCP tool bridge, and trace logging.
- **Agentic Reasoning (20%):** Structured 7-step pipeline from intent to follow-up.
- **Matching Quality (20%):** Deterministic ranking (distance, rating, reliability).
- **Action Simulation (15%):** Booking state changes and follow-ups.
- **Technical Implementation (10%):** Zod contracts, Adapters, TS monorepo.
- **Innovation & UX (10%):** Urdu/Roman-Urdu parsing and transparent UI handoff.
