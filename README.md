# formPT

A PT (personal training) booking and management app built around a single-trainer, multiple-member structure. Trainers manage member bookings, remaining PT sessions, and workout records; members view their bookings and PT usage.

## Key Features

### Sign-up, Onboarding & Trainer Connection
- During the initial onboarding survey, no trainer list is shown — members connect to a specific trainer only via invite code
- Invite codes are validated server/DB-side and are single-use (duplicate use prevented)
- Members who sign up without a code can use `Find a Trainer` on the home screen to search by name (2+ characters) and send a connection request
- Connection requests are confirmed once the trainer approves; until then, booking/PT session/workout record features are replaced with a "connect with a trainer" guidance screen

### Bookings & PT Management
- Tracks each member's remaining PT sessions and upcoming bookings
- Handles pending re-enrollment consultation requests

### Member Withdrawal Requests
- Members can request account withdrawal from the settings screen, going through a two-step confirmation (password re-verification, typed final confirmation)
- Status is tracked as `Requested / Needs Review / Approved / Rejected / Cancelled by Member`
- On admin approval: login and booking are blocked, future bookings are cancelled, open re-enrollment consultations are closed, and unnecessary profile info (e.g. photo) is removed — but past bookings, workout records, PT usage history, and revenue records are preserved (shown as "Withdrawn Member" in historical records)
- Auth accounts are access-blocked rather than hard-deleted, to avoid cascading deletion of historical records

### Admin Dashboard
- Sign-up requests and withdrawal requests are surfaced on one screen for approve/reject/hold actions
- Member list shows name, full phone number (tap-to-call and copy supported), status, and remaining PT sessions as mobile-friendly cards

## Design
Cream, black, and lime-green color palette with rounded cards, designed mobile-first.

## Access Policy
- Members: can view/create/cancel only their own connection requests and withdrawal requests
- Trainers: can view/approve/reject only connection requests sent to them
- Admins: can view all sign-up and withdrawal requests and issue final approval/rejection
- Withdrawn (deactivated) members cannot access member features even via direct API calls

## Data Principles
- Member, booking, workout record, PT usage history, and revenue data are never arbitrarily deleted or reset
- Schema changes are always applied via safe migrations
- Sensitive values such as admin secret keys are never included in client-side code

---
> This README is based on the planning discussion so far. Once the actual codebase is connected, tech stack, setup instructions, and folder structure can be added.
