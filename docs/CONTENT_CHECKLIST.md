# Content checklist (what to provide before go-live)

finaisolutions.co could not be reached from the build environment, so everything below is a **placeholder**. Placeholder text renders on the site in a yellow dashed box starting with `[PLACEHOLDER]`. Search the code for `PLACEHOLDER` to find each one.

## Site pages (text)
| Page | What to provide | Where it goes |
|---|---|---|
| Home `/` | Headline, sub-heading, "about"/value section, any other sections | `src/app/(site)/page.tsx` |
| Courses `/courses/` | Intro text, if any | `src/app/(site)/courses/page.tsx` |
| Pricing `/pricing/` | Intro text; bundle descriptions (editable in admin) | `src/app/(site)/pricing/page.tsx`, Admin → Offers |
| About `/about/` | Full text | `src/app/(site)/about/page.tsx` |
| Contact `/contact/` | Intro text; support phone if shown | `src/app/(site)/contact/page.tsx`, `src/config/site.ts` |
| Terms & Conditions | Full current text + last-updated date | `src/app/(site)/terms-conditions/page.tsx` |
| Privacy Policy | Full current text + date | `src/app/(site)/privacy-policy/page.tsx` |
| Refund Policy | Full current text + date | `src/app/(site)/refund-policy/page.tsx` |
| Site tagline / meta description | One sentence | `src/config/site.ts` |

## Company / payments config (`src/config/site.ts`)
- `cardDescriptor`: the exact text on customers' card statements (from Authorize.Net / your processor).
- `supportPhone`: optional but recommended.
- Logo / favicon files, if any.

## Each of the 16 courses (Admin → Courses, or edit `supabase/seed.sql` before seeding)
For each course: **slug as on the live site** (`/product/<slug>/`), category, level, page count, short description, full description, single-course price (or leave empty if only sold in bundles), image, and the course file(s) (PDF etc.).

Slugs are currently **guessed** from WooCommerce's slug rules. Verify each against the live URL:

| Course | Guessed slug |
|---|---|
| AI Automation Playbook | `ai-automation-playbook` |
| AI for Business Strategy | `ai-for-business-strategy` |
| AI for Healthcare Innovation | `ai-for-healthcare-innovation` |
| AI Fundamentals: The Complete Guide | `ai-fundamentals-the-complete-guide` |
| AI Product Management | `ai-product-management` |
| AI-Powered Marketing | `ai-powered-marketing` |
| Computer Vision Handbook | `computer-vision-handbook` |
| Creative AI: Art, Music & Design | `creative-ai-art-music-design` |
| Data Science with Python & AI | `data-science-with-python-ai` |
| Deep Learning Architecture | `deep-learning-architecture` |
| Generative AI: From GPT to Diffusion | `generative-ai-from-gpt-to-diffusion` |
| Machine Learning Decoded | `machine-learning-decoded` |
| Natural Language Processing | `natural-language-processing` |
| Prompt Engineering Mastery | `prompt-engineering-mastery` |
| Robotics & AI Integration | `robotics-ai-integration` |
| The Ethics of Artificial Intelligence | `the-ethics-of-artificial-intelligence` |

Categories (5) and levels (Beginner/Intermediate/Advanced) are guesses. Replace them in Admin → Categories & levels, using the live category slugs (`/product-category/<slug>/`).

## Bundles (Admin → Bundles / offers)
Seeded: Starter $250 (3), Professional $400 (5), Enterprise $1,000 (7), Complete $1,500 (15). Each currently includes the first N courses by sort order. **Choose the actual courses for each bundle.**

## Other
- Full list of live URLs (sitemap), so any extra paths can be redirected.
- Any existing customers or orders to migrate (not included; can be scripted from a WooCommerce export).
