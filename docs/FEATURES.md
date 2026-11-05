# Features

Status key: ✅ built · 🟡 partial · ⬜ planned. Based on the code as of 2026-11-05; "built" means the code exists, not that it has been tested (there are no automated tests yet).

## Accounts and identity

| Feature | Status | Notes |
|---|:-:|---|
| Register as student / company / mentor | ✅ | `admin` cannot self-register |
| Login / "remember me" | ✅ | JWT in localStorage or sessionStorage |
| Email verification (6-digit code) | 🟡 | Codes work; **not enforced server-side** (SECURITY S-1) |
| Phone verification | 🟡 | Code flow exists; delivery channel is email-based code today. Confirm SMS plans |
| Forgot / reset password | ✅ | Single-use hashed token, 60 min |
| Profile editing (student, company, mentor) | ✅ | Role-specific JSONB profiles; CV URL |
| Theme preference | ✅ | Saved per user |
| Account suspension | ✅ | Admin |

## Opportunities (`/opportunities`, `/applicants`)

| Feature | Status |
|---|:-:|
| Company creates, edits, deletes jobs/internships | ✅ |
| Admin approval/rejection | ✅ |
| Public browse with filters/pagination | ✅ |
| Student applies once with cover letter and CV | ✅ |
| Company reviews applicants; status pipeline (submitted, reviewing, shortlisted, rejected, hired) | ✅ |
| Deadline auto-close | ⬜ |
| Application withdrawal | ⬜ |
| Applicant email notifications | ⬜ |

## Marketplace and business ads (`/marketplace`, `/business-ads`)

| Feature | Status |
|---|:-:|
| Create/edit/delete ads with image upload | ✅ |
| Categories (technology, food, fashion, events, services, housing, other) | ✅ |
| Admin approval | ✅ |
| One-active-ad limit on Free plan | 🟡 enforcement not confirmed in `adController`; verify |
| Featured placement for paid plans | ⬜ promised in plan copy, not implemented |
| Reach analytics | ⬜ |

## Learning hub (`/learning`)

| Feature | Status |
|---|:-:|
| Mentor publishes courses | ✅ |
| Admin approval | ✅ |
| Student enrolment | ✅ (array on course row) |
| Enrolment analytics, reviews, certificates | ⬜ |

## Community (`/community`)

| Feature | Status |
|---|:-:|
| Posts with categories (discussion, question, announcement, group, event) | ✅ |
| Replies | ✅ |
| Pin (admin) and delete post/reply (moderation) | ✅ |
| Report/flag content, notifications | ⬜ |

## Services directory (`/services`)

| Feature | Status |
|---|:-:|
| Admin-curated listing by category | ✅ |
| Archive/restore | ✅ |

## Billing (`/settings`, `/billing/return`)

| Feature | Status |
|---|:-:|
| Plan catalogue (Free, Business Pro, Employer Pro, Mentor Pro) | ✅ |
| Free subscription auto-created at signup | ✅ |
| Flutterwave checkout, verify, webhook | ✅ built, **disabled** until `PAYMENTS_ENABLED=true` |
| Mock gateway for development | ✅ (boot now refuses mock + payments enabled) |
| Cancel at period end | ✅ endpoint exists |
| Renewals / dunning / invoices | ⬜ |
| Mobile-money tuning | ⬜ |

## Admin (`/admin`)

| Feature | Status |
|---|:-:|
| Analytics overview | ✅ |
| Approval queues (jobs, ads, courses) | ✅ |
| Users: list, filter, suspend, change role | ✅ |
| Community and services management | ✅ |
| Audit log | ⬜ |

## Platform

| Feature | Status |
|---|:-:|
| REST API with 56 routes | ✅ |
| Pagination everywhere (max 100) | ✅ |
| Image upload + prune script | ✅ |
| Rate limiting (Redis optional) | ✅ |
| Health endpoint | ✅ |
| Light/dark responsive UI | ✅ |
| Automated tests / CI | ⬜ |
| Swahili localisation | ⬜ |
