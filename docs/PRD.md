# Product Requirements Document (PRD)

**Product:** Excel Connect Hub
**Status:** Draft v1, reverse-engineered from the current codebase (2026-11-05). Items marked *(proposed)* are not built yet.
**Owner:** Product / Founder

---

## 1. Summary

Excel Connect Hub is a web platform for Tanzania's student and early-career ecosystem. It puts university students, employers, mentors, and local businesses in one place so that students can find work, skills, and services, and the organisations that want to reach them can do so directly.

## 2. Problem

- Students leave university without a trusted, single place to find internships, jobs and credible training.
- Employers and SMEs have no cheap, targeted channel to reach students; they rely on scattered WhatsApp groups and social posts.
- Mentors and training providers who want to teach have no distribution channel.
- Students on shared campus connections and low-cost phones need something light, fast and free to start.

## 3. Goals

| # | Goal | Measure of success *(proposed targets)* |
|---|---|---|
| G1 | Students can discover and apply to opportunities in under 3 minutes from signup | Median time to first application |
| G2 | Employers can post and manage listings and review applicants without help | % of company accounts that publish a job unaided |
| G3 | Mentors can publish courses and students can enrol | Courses published; enrolments per course |
| G4 | The platform is moderated and trustworthy | Median time-to-approval for submitted content < 48h |
| G5 | The platform can start earning without rework | Paid plan switched on via config, no code change |

### Non-goals (v1)

- Hosting or authoring course content (video, lessons). The platform lists mentors' courses; it does not deliver them.
- In-app messaging between users.
- Native mobile apps.
- Resume/CV builder.

## 4. Users and roles

| Role | Who | Core needs |
|---|---|---|
| **Student** | University students and recent graduates | Find jobs and internships, apply, enrol in courses, join the community, find campus services |
| **Company** | Employers, recruiters | Post jobs/internships, review and progress applicants, advertise |
| **Mentor** | Independent trainers and training providers | Publish courses, reach students |
| **Admin** | Platform staff | Approve content, moderate community, manage users, see analytics |

Businesses/SMEs advertise through the marketplace; in the data model an ad owner is an authenticated user (typically a company account). *(Open question: should "business" become its own role? see section 10.)*

## 5. Scope and requirements

Priority: **P0** = must for launch, **P1** = soon after, **P2** = later.

### 5.1 Accounts and trust
- P0 Register as student, company or mentor; admin accounts are provisioned by CLI only.
- P0 Email/password login with JWT sessions; "remember me" persistence.
- P0 Email verification by 6-digit code; optional phone verification.
- P0 Password reset by emailed single-use link.
- P0 Suspend/reactivate accounts (admin).
- **P0 Enforce email verification on the server** before an account can publish content. *Not enforced today; see SECURITY.md S-1.*

### 5.2 Opportunities
- P0 Companies create jobs/internships (title, type, location, work mode, description, requirements, salary range, deadline).
- P0 Admin approval before a listing is public.
- P0 Students apply once per listing with a cover letter and CV link; companies move applicants through submitted, reviewing, shortlisted, rejected, hired.
- P1 Application withdrawal; deadline auto-close *(proposed)*.

### 5.3 Marketplace and business ads
- P0 Businesses post ads (category, description, price, contact, image, link); admin approval.
- P0 Free plan: one active ad. Paid plan: unlimited and featured placement.
- P1 Reach analytics *(listed on the Business Pro plan; not built)*.

### 5.4 Learning hub
- P0 Mentors publish courses (category, duration, price, delivery mode, start date); admin approval.
- P0 Students enrol in approved courses.
- P1 Course reviews; enrolment analytics *(Mentor Pro promise; not built)*.

### 5.5 Community
- P0 Posts (discussion, question, announcement, group, event) and replies; admin can pin and delete.
- P1 Reporting/flagging of posts *(proposed)*.

### 5.6 Services directory
- P0 Admin-curated directory of campus/youth services (academic, career, wellbeing, financial, housing, technology, library, other).

### 5.7 Billing
- P0 Plan catalogue visible to all users; Free plan active for everyone.
- P0 Paid checkout stays disabled ("coming soon") until `PAYMENTS_ENABLED=true` with valid Flutterwave keys.
- P0 Payments verified server-side (amount and currency checked) before granting a plan.
- P1 Mobile-money-first checkout (M-Pesa, Tigo Pesa, Airtel Money) via Flutterwave.

### 5.8 Admin
- P0 Analytics overview; approval queues for jobs, ads and courses; user, community and service management.

## 6. Plans (current catalogue)

| Plan | Audience | Price (TZS/mo) | Highlights |
|---|---|---|---|
| Free | All | 0 | Full access; one active ad |
| Business Pro | Business | 25,000 | Unlimited ads, featured placement, priority review |
| Employer Pro | Company | 35,000 | Unlimited postings, promoted listings, applicant analytics |
| Mentor Pro | Mentor | 20,000 | Unlimited courses, featured placement, enrolment analytics |

Everything is free at launch; paid tiers are visible but not purchasable.

## 7. Non-functional requirements

- **Performance:** usable on slow mobile connections; list endpoints paginated (default 20, max 100).
- **Availability:** single-region, best-effort for v1; `/health` endpoint for uptime checks.
- **Security:** see SECURITY.md. No unverified or suspended user may act; uploads are images only.
- **Accessibility and theming:** responsive layout, light/dark themes.
- **Localisation** *(proposed)*: Swahili UI. Currency is TZS throughout.
- **Shared-IP reality:** rate limits must not lock out a whole campus behind one NAT address.

## 8. Success metrics *(proposed)*

Activation (verified accounts / signups), applications per live job, enrolments per live course, approved-content ratio, weekly active users, and, once payments are on, free-to-paid conversion.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Marketplace cold start (no jobs means no students, and vice versa) | Seed with partner employers and campus mentors; admin-curated services directory gives value on day one |
| Spam and low-quality listings | Approval queue plus verified-email requirement |
| Payment fraud/spoofing | Server-side verification and webhook signature check |
| Uploaded files filling the disk | Local disk is the current store; move to object storage before scale (see ARCHITECTURE.md) |

## 10. Open questions

1. Is "business/SME" a separate role from "company"?
2. Should email verification gate *login* or only *publishing*?
3. Mobile money providers required at launch?
4. Who staffs moderation, and what is the target approval SLA?
5. Is Swahili required for launch?
