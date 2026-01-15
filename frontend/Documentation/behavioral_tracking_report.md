# Behavioral Tracking Implementation Report

## Overview
As part of the Design Thinking Stage 5 (Test), a custom behavioral tracking system was developed and integrated into the Student Portal. This system was designed to capture granular user interaction data without relying on third-party cookies or intrusive trackers.

## Technical Architecture

### 1. Client-Side: `analytics.js`
A custom JavaScript tracking library was developed to monitor the following events:
- **Navigation Events**: Page views, hash changes, and view switching.
- **Interaction Events**: Button clicks, link clicks, and card selections.
- **Form Analytics**: Input focus, field changes, and submission success/failure.
- **Behavioral Metrics**: Scroll depth (percentage), time-on-page, and inactivity periods.

### 2. Backend API: Analytics Endpoints
The Node.js/Express backend was extended with several specialist endpoints:
- `POST /api/analytics/events`: Batch processing of interaction logs.
- `GET /api/analytics/summary`: Aggregate calculation of average session times and hotspots.
- `GET /api/analytics/export`: Logic to convert binary database records into CSV/JSON for research.

### 3. Data Storage: MongoDB
Dedicated schemas were created for high-performance logging:
- **`AnalyticsSession`**: Stores metadata about the user session (browser, duration, user ID).
- **`AnalyticsEvent`**: Stores individual actions with precise timestamps and contextual data (e.g., button text, form ID).

## Behavioral Insights Captured
The system successfully captured **1,553 unique events** during the testing phase. Key insights include:
- **Hotspots**: The "Assignments" section received the highest interaction frequency (30+ clicks per session).
- **Friction Points**: Users spent the most time (average 320s) on the "Assignment Submission" view, indicating a need for more streamlined upload feedback.
- **Engagement**: A 100% scroll rate on the Dashboard Overview indicated high content relevance.

## Compliance and Anonymity
- All data is anonymized using unique Participant IDs (e.g., P001).
- Tracking only begins after explicit user consent on the Test Starter page.
- No personally identifiable information (PII) is captured in the analytics logs.
