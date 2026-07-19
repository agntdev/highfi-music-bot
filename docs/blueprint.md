# High-Res Music Streamer — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot offering free FLAC/ALAC streaming and downloads from a mixed library of owner-provided and licensed tracks, with user registration, quality tier selection, and admin content management.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- audiophiles
- casual listeners
- mobile users

## Success criteria

- 1000+ active monthly users with 20% retention
- 95% successful stream/download requests
- Admin can manage content without technical barriers

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with quick access to search, profile, and library
- **/search** (command, actor: user, command: /search) — Initiate track search with optional query parameter
- **Browse Library** (button, actor: user, callback: library:curated) — Show curated playlists and owner-uploaded collections
- **/profile** (command, actor: user, command: /profile) — Display user account details and listening history
- **/upload** (command, actor: admin, command: /upload) — Admin interface for adding new tracks

## Flows

### onboarding
_Trigger:_ /start

1. Display welcome message
2. Prompt for registration
3. Create account with Telegram ID
4. Show quick commands

_Data touched:_ User

### search_play
_Trigger:_ search command/button

1. Show search results with play/download buttons
2. Handle quality selection
3. Start streaming with controls

_Data touched:_ Track, Session

### admin_upload
_Trigger:_ /upload

1. Request metadata
2. Receive file
3. Validate and store
4. Confirm availability

_Data touched:_ Track

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Registered Telegram users with listening history
  - fields: Telegram ID, email, registration timestamp, preferences
- **Track** _(retention: persistent)_ — Audio files with metadata and quality options
  - fields: title, artist, album, formats, source type, license status
- **Session** _(retention: session)_ — Active playback and download sessions
  - fields: current track, progress, format

## Integrations

- **Telegram** (required) — Messaging and file delivery
- **External Music Sources** (optional) — Licensed track fetching
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Upload and remove tracks
- View usage statistics
- Configure external sources
- Manage takedown requests

## Notifications

- Admin alerts for upload completion
- License compliance warnings
- Takedown confirmation notifications

## Permissions & privacy

- Telegram ID used as primary login
- Optional email collection with opt-in
- User history stored with consent

## Edge cases

- Requested quality unavailable - offer nearest alternative
- Large file downloads requiring link delivery
- Unauthorized access attempts

## Required tests

- End-to-end registration flow
- Search result accuracy
- Streaming format selection
- Admin upload workflow
- Session persistence across reconnects

## Assumptions

- Telegram ID sufficient for authentication
- Mixed library sources as specified
- Admin will configure external sources during setup
