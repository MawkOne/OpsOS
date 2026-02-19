This is excellent.

Now we can stop theorizing and talk concretely.

Your current structure is date-centric and channel-metric heavy.

It is:

A daily operational dashboard snapshot.

It is not yet structured for training a CEO-style decision model.

That’s fine. It’s a strong raw input layer.

Let’s walk through what you have and what needs to change.

🔎 What Your Current JSON Is

Each date contains:

Traffic metrics

Channel breakdown

Campaign-level stats

Email totals

Funnel metrics (talent + company)

Stripe revenue

Subscription snapshot

This is a state snapshot of the business at time t.

That’s good.

But for the system you want, this needs to be transformed.

🚨 What’s Missing for CEO-Level Training

Right now:

You have daily totals.

You do not have cohort lineage.

You do not have lifecycle transitions.

You do not have explicit action logs.

You do not have exposure tracking (who saw which version).

Right now the AI would learn:

“Revenue went down when sessions went down.”

That’s analytics.

Not control learning.

🧠 What Needs To Happen

Your current JSON is Layer 0: Observations.

We need to derive two new layers:

1️⃣ Cohort Table (Decision Cohorts)

Instead of daily totals, build:

signup_date × acquisition_source × landing_page × promo × geo


For example:

2026-02-06 × paid_search × lp_v2 × 10% discount × US


For that cohort, track over time:

purchases

revenue

churn

upgrades

reactivation

Right now your Stripe + signup data can be used to build this.

2️⃣ Cohort-Age Panel

You need:

cohort_id × age_day


With:

active_subscriptions

mrr_today

churn_today

upgrades_today

cumulative_revenue

etc.

Right now you only have subscription snapshot totals, not cohort survival curves.

You’ll need to derive:

subscription start date

subscription cancellation date

price tier

upgrade/downgrade events

Stripe data likely contains this.

3️⃣ Action Log Table

This is critical.

From your JSON I do not see a clean record of:

When onboarding version changed

When paywall changed

When pricing changed

When promo depth changed

When email cadence changed

When new ad creative rolled out

When budget changed

Right now you have outputs.
You don’t have action records.

Without this, the AI cannot learn what actions matter.

🔧 How To Transform Your Current Data

You keep your daily JSON as:

business_daily_snapshot


Then derive:

A) Cohort Acquisition Table

From:

traffic_sources

google_ads campaign data

signups

stripe purchases

Construct:

cohort_id
signup_date
channel
campaign_cluster
landing_page_group
geo
cohort_size
cac

B) Subscription Lifecycle Table

From Stripe:

Per subscription:

subscription_id
cohort_id
start_date
cancel_date
price
upgrade_events
downgrade_events
reactivation_date
``

okay before we go there, this is not a saas tool. It is a job site market place. 

{
  "2026-02-06": {
    "website_traffic": {
      "_description": "GA4 session and engagement metrics for this date",
      "sessions": 7378,
      "sessions_7d_avg": 13845.57,
      "sessions_dod": -6838,
      "sessions_wow_pct": -48.08,
      "engaged_sessions": 3912,
      "engagement_rate_pct": 53.02,
      "events_per_session": 8.99,
      "total_events": 67704,
      "key_events": 418
    },
    
    "traffic_sources": {
      "_description": "GA4 traffic breakdown by channel for this date",
      "direct_sessions": 2020,
      "direct_pct": 27.38,
      "organic_sessions": 1199,
      "organic_pct": 16.25,
      "organic_engaged_sessions": 771,
      "organic_engagement_rate": 64.30,
      "referral_sessions": 2022,
      "referral_pct": 27.41,
      "email_traffic_sessions": 405,
      "social_sessions": 482,
      "video_sessions": 60,
      "paid_search_sessions": 147,
      "paid_search_engaged_sessions": 106,
      "paid_pmax_sessions": 467,
      "paid_pmax_engaged_sessions": 327,
      "total_paid_sessions": 614,
      "paid_pct": 8.32,
      "paid_engagement_rate": 70.52
    },
    
    "google_ads": {
      "_description": "Google Ads campaign performance from GA4 Data API (daily, no cost data)",
      "_source": "marketing_ai.daily_entity_metrics (entity_type=google_ads_campaign)",
      "total_sessions": 1242,
      "total_users": 1023,
      "total_conversions": 268,
      "total_revenue": 495.0,
      "pmax_campaigns": {
        "sessions": 1010,
        "users": 817,
        "conversions": 201,
        "campaigns": [
          {"name": "Channel - PMax - Hire editor - 5 - (worldwide - G=verified)", "sessions": 723, "users": 580, "conversions": 142},
          {"name": "Channel - PMax - Hire editor - 4 - (US-CA - G=verified)", "sessions": 197, "users": 157, "conversions": 49, "revenue": 495.0},
          {"name": "Talent - PMax - 2 - (US-CA)", "sessions": 90, "users": 80, "conversions": 10}
        ]
      },
      "search_campaigns": {
        "sessions": 232,
        "users": 206,
        "conversions": 67,
        "campaigns": [
          {"name": "Channel - Search - Hire-writer - 6 - (G=verified)", "sessions": 123, "users": 114, "conversions": 22},
          {"name": "Channel - Search - Hire-designer - 7 - (G=verified)", "sessions": 71, "users": 57, "conversions": 21},
          {"name": "Channel - Search - Hire-editor - 3 - (G=verified)", "sessions": 31, "users": 29, "conversions": 19},
          {"name": "Channel - Search - Hire-editor - 2 - (G=Purch.)", "sessions": 7, "users": 6, "conversions": 5}
        ]
      }
    },
    
    "email_campaign_totals": {
      "_description": "ActiveCampaign cumulative/lifetime stats across ALL campaigns (not daily)",
      "campaigns_launched": 5,
      "campaign_lifetime_sends": 534469,
      "campaign_lifetime_opens": 170655,
      "campaign_lifetime_clicks": 36385,
      "campaign_avg_open_rate": 34.91,
      "campaign_avg_ctr": 8.48,
      "campaign_click_to_open_pct": 21.32,
      "email_contacts_total": 0,
      "email_list_subscribers_total": 0
    },
    
    "email_daily_activity": {
      "_description": "Email opens/clicks that occurred ON this date (from any campaign sent previously)",
      "sends": 0,
      "opens": 118,
      "unique_openers": 44,
      "clicks": 0,
      "unique_clickers": 0
    },
    
    "talent_funnel": {
      "_description": "Talent/job seeker metrics for this date",
      "talent_signups": 371,
      "talent_signups_7d_avg": 413.14,
      "talent_signups_dod": 0,
      "talent_signups_wow_pct": -12.5,
      "talent_signup_rate_pct": 5.03,
      "applications": 1567,
      "applications_7d_avg": 1594.71,
      "applications_dod": -98,
      "profile_views": 24599,
      "reviews": 126,
      "hires": 0,
      "app_to_hire_pct": 0.0,
      "match_rate_pct": 0.0
    },
    
    "company_funnel": {
      "_description": "Company/employer metrics for this date",
      "company_signups": 140,
      "company_signups_7d_avg": 136.71,
      "company_signups_dod": -16,
      "company_signup_rate_pct": 1.90,
      "cumulative_company_signups": 43494,
      "purchases": 12,
      "purchases_7d_avg": 11.43,
      "purchases_dod": 0,
      "company_purchase_conversion_pct": 8.57,
      "_purchase_note": "Purchases now sourced from Stripe - see stripe_revenue section for breakdown"
    },
    
    "jobs": {
      "_description": "Job posting metrics for this date",
      "jobs_posted": 47,
      "job_views": 15334,
      "apps_per_job": 33.34
    },
    
    "signups_combined": {
      "_description": "Combined signup metrics (talent + company)",
      "total_signups": 511,
      "overall_signup_rate_pct": 6.93
    },
    
    "stripe_revenue": {
      "_description": "Actual payment revenue from Stripe (source of truth for revenue)",
      "_source": "marketing_ai.raw_stripe (data_type=charge, status=succeeded)",
      "daily_revenue": 1485.0,
      "daily_revenue_7d_avg": 1735.0,
      "daily_revenue_dod": -9.0,
      "successful_transactions": 12,
      "failed_transactions": 1,
      "revenue_per_session": 0.20,
      "revenue_per_talent_signup": 4.00,
      "transactions_by_price": {
        "$199": 1,
        "$198": 1,
        "$149": 3,
        "$148": 2,
        "$99": 2,
        "$49": 3
      }
    },
    
    "stripe_subscriptions": {
      "_description": "Recurring subscription metrics from Stripe (snapshot at sync time)",
      "_source": "marketing_ai.daily_entity_metrics (entity_type=subscription_summary)",
      "mrr": 8234.0,
      "arr": 98808.0,
      "active_subscriptions": 29,
      "churned_subscriptions": 114,
      "churn_rate_pct": 79.72
    },
    
    "ga4_ecommerce": {
      "_description": "GA4 attributed e-commerce revenue (campaign attribution, may differ from Stripe)",
      "_source": "marketing_ai.daily_entity_metrics (entity_type=website_traffic)",
      "attributed_revenue": 2572.0,
      "_note": "GA4 revenue is based on conversion attribution and may differ from actual Stripe payments"
    }
  }
}

Perfect. This changes the architecture meaningfully.

You are not SaaS.

You are a two-sided job marketplace:

Talent side (supply)

Company side (demand / revenue side)

Transactions (job posts, subscriptions, hires)

That means your AI CEO is not optimizing subscription retention curves alone.

It is optimizing:

Marketplace liquidity + revenue per active company + supply quality balance.

This is a very different control problem.

Let’s reset cleanly.

🎯 What You Actually Want to Optimize (Marketplace Version)

In a job marketplace, “healthy recurring base” becomes:

Sufficient active companies paying

Sufficient high-quality talent applying

High match / hire probability

Efficient acquisition cost

Stable revenue per active employer

Your real objective becomes something like:

Maximize marketplace gross profit while maintaining supply-demand balance.

Not just month-3 revenue.

🔥 Core Difference From SaaS

In SaaS:
Customer value is mostly internal (subscription lifecycle).

In marketplace:
Value depends on interaction between two sides.

If:

You acquire too many companies → low talent supply → churn.

Too much talent → low job fill → low company satisfaction → churn.

So your CEO AI must learn cross-side effects.

🧠 How Your Current JSON Fits

Your JSON is very strong for:

Demand-side acquisition (companies)

Supply-side acquisition (talent)

Funnel health

Transaction revenue

Channel mix

But it is missing:

Per-company lifecycle revenue

Per-company tenure

Per-company repeat purchasing behavior

Per-job fill outcomes over time

Cohort-based employer durability

🏗 How I Would Structure This Marketplace System

Forget SaaS subscription modeling for a moment.

You need 4 core dynamic components.

1️⃣ Company Cohort Model (Revenue Side)

Define cohorts by:

company_signup_date × acquisition_channel × pricing_offer


Track over time:

purchases

subscription status

repeat purchases

churn

lifetime revenue

This is similar to SaaS, but employer behavior may be episodic.

2️⃣ Talent Cohort Model (Supply Side)

Define cohorts by:

talent_signup_date × acquisition_channel


Track:

applications submitted

profile completeness

response rate

hire conversion rate

retention (are they active after X days)

Talent activity affects company satisfaction.

3️⃣ Marketplace Liquidity Model

This is the critical part.

Per day or week, track:

active companies

active talent

jobs posted

applications per job

fill rate

hire time

These are cross-side equilibrium metrics.

This becomes part of the system state.

4️⃣ Revenue Generation Model

Revenue comes from:

job posting purchases

subscription plans

add-ons

Track per employer:

revenue per active employer

frequency of purchase

upgrade behavior

🔄 So What Is The AI Training Target Now?

Given this is a marketplace, not SaaS:

Your best short-horizon reward is probably:

Cohort Revenue Per Company by Month 2–3

AND

Marketplace Liquidity Stability

Because if liquidity collapses, revenue collapses.

📊 For Your Specific JSON

What I see:

140 company signups

12 purchases

$1485 Stripe revenue

371 talent signups

1567 applications

47 jobs posted

This is already a multi-system dynamic.

If your AI only optimizes revenue per company,
it might:

Push price increases

Reduce company acquisition

Reduce jobs

Reduce liquidity

Hurt long-term revenue

The AI must learn system balance.

🧠 The Correct State Representation For Your CEO AI

Each day’s state should include:

Demand side:

active_companies

revenue_per_company

purchase_rate

churn_rate

Supply side:

active_talent

applications_per_job

match_rate

response_time

Liquidity:

jobs_posted

apps_per_job

hire_rate

Acquisition:

CAC by side

channel mix

Revenue:

daily_revenue

mrr (if subscription)

repeat purchase frequency

🎯 So What Should You Optimize?

For a marketplace, I would suggest:

Primary Objective:

Maximize expected 90-day gross profit from company cohorts

Subject to:

applications_per_job within healthy range

hire_rate above threshold

churn below threshold

CAC below threshold

That keeps the marketplace healthy.

⚠️ Important

Your Stripe subscription snapshot shows:

active_subscriptions: 29
churn_rate_pct: 79.72


That churn number looks structurally odd.
If that’s accurate, that’s a massive instability in employer retention.

Your AI would need to learn:

Is revenue episodic (job postings)?

Or subscription-based?

Or hybrid?

That changes the model form dramatically.

📌 Before We Continue

Answer this:

Are companies primarily one-time purchasers of job posts?

Or recurring subscribers?

Or both?

What percentage of revenue is recurring vs transactional?

That determines whether we model this as:

Subscription retention model

Purchase frequency model

Or episodic demand model

The architecture changes significantly depending on that.

the vast majority is one time purchases. I need to fix the subscription part. Its 90% job ad purchases and 10% subscriptions

Good. That simplifies things a lot.

You are not a SaaS company with retention as the core loop.

You are a transaction-heavy marketplace where:

90% of revenue = one-time job ad purchases

10% = subscription (currently weak / broken)

That means:

Your core economic engine is purchase frequency and repeat demand from companies.

Not subscription churn curves.

So we must stop thinking SaaS lifecycle and start thinking purchase recurrence + marketplace liquidity.

🧠 What This Means For Your AI CEO

Your system should optimize:

1️⃣ Revenue per company over time
2️⃣ Repeat purchase probability
3️⃣ Time between purchases
4️⃣ Marketplace balance (supply-demand health)

The subscription piece is secondary for now.

🎯 The Correct Training Target

Instead of Month-3 subscription gross profit, you want:

🔵 60–90 Day Company Revenue Cohort Value

For each company signup cohort:

cohort_id = company_signup_date × acquisition_channel × geo × campaign_cluster


Track:

who purchased at least once
repeat purchasers

total revenue generated within 90 days

time to first purchase

time between purchases

Then define reward:

𝑅
𝑒
𝑤
𝑎
𝑟
𝑑
90
𝑑
=
Total Revenue From Cohort in 90 Days
−
Acquisition Cost
Reward
90d
	​

=Total Revenue From Cohort in 90 Days−Acquisition Cost

That’s your training label.

This aligns with:

Transaction-heavy model

Shorter feedback loop

Realistic repeat purchase window

Marketplace demand cycles

🏗 What You Need Structurally
1️⃣ Company Cohort Table

Each row:

{
  "cohort_id": "2026-02-01_paid_search_US",
  "signup_date": "2026-02-01",
  "channel": "paid_search",
  "cohort_size": 140,
  "cac_total": 3200.00,

  "first_purchase_rate_30d": 0.18,
  "repeat_purchase_rate_90d": 0.07,

  "revenue_30d": 3800.00,
  "revenue_60d": 6200.00,
  "revenue_90d": 8100.00,

  "reward_90d": 4900.00
}


That is your decision-level training data.

2️⃣ Marketplace State Variables (Critical)

Because you’re two-sided, add:

apps_per_job

jobs_posted

active_talent

match_rate

time_to_first_application

fill_rate

These become context features when training.

Your AI must learn:

If apps/job drops below X, repeat purchase probability falls.

This is marketplace physics.

🔥 The Real Control Levers

In your case, the AI CEO is deciding things like:

Increase paid search spend?

Change employer pricing?

Bundle job credits?

Improve talent activation?

Boost supply acquisition?

Offer discounts?

Change job visibility algorithm?

Increase email reactivation campaigns?

Those actions affect:

Purchase frequency

Repeat purchase probability

Employer satisfaction

Marketplace balance

🧠 What We Are Training Now

You are training a model that learns:

State_t + Action_t → Company Purchase Behavior Over Next 90 Days


Not subscription churn.

Not LTV 24 months.

Not SaaS retention curves.

This is a repeat-purchase marketplace model.

📊 Why 90 Days?

Because:

Most job posting need cycles are shorter.

Repeat demand likely appears within 1–3 months.

Signal is stronger and faster.

Subscription modeling isn’t dominant.

If companies typically hire every 45–60 days, 90d captures repeat cycle.

⚖️ The New Objective

Your AI CEO should maximize:

🔵 Expected 90-Day Gross Profit from Newly Acquired Companies

Subject to:

Apps per job above minimum liquidity threshold

CAC within budget

Supply side stable

That is healthy recurring marketplace growth.

📌 Key Difference From SaaS

In SaaS:
Retention = core.

In your model:
Repeat purchasing = core.

Retention is only relevant if subscriptions grow.

🚨 One Important Question

What is the typical time between job ad purchases for repeat companies?

30 days?

60 days?

90 days?

Sporadic?

That determines the optimal training horizon (60d vs 90d vs 120d).

We’re now aligned with your real business model.

Tell me the typical repeat purchase cadence and I’ll define the exact training structure for your AI CEO.

so the majority of companies purchase what they need in 1st month. But the best companies repeat purchase several months later.

Good. That’s the key structural truth of your business.

Let’s restate it clearly:

Most companies buy once in month 1 and disappear.

The best companies come back months later and buy again.

Revenue concentration likely comes from a small % of repeat buyers.

That means your AI CEO should not optimize:

“Total revenue in first 30 days.”

That would bias it toward low-quality one-time buyers.

Instead, it must optimize for:

Acquiring and nurturing companies with high repeat purchase probability.

Now we design training correctly.

🔥 The Real Economic Engine

You have two company types:

Single-post buyers

Repeat buyers (high-value segment)

The entire long-term business depends on increasing the share of type #2.

So the model must learn:

Which acquisition attributes produce repeat buyers?

Which early behaviors signal future repeat purchase?

Which actions increase probability of a second purchase?

This is not SaaS retention.
This is repeat demand modeling.

🎯 Correct Training Objective

Given your structure, the right reward is:

🔵 120-Day Company Cohort Revenue

Why 120 days?

Because:

Month 1 captures first purchase.

Months 2–4 capture repeat cycle.

It gives repeat signal.

It doesn’t require waiting a year.

So for each company signup cohort:

𝑅
𝑒
𝑤
𝑎
𝑟
𝑑
120
𝑑
=
Total Revenue Generated in 120 Days
−
CAC
Reward
120d
	​

=Total Revenue Generated in 120 Days−CAC

That becomes your core reward.

🧠 What The AI Should Learn

It should learn:

Paid Search might produce more 1-time buyers.

Organic/referral may produce higher repeat buyers.

Certain pricing tiers correlate with repeat demand.

Certain job categories repeat more.

Companies that receive X applications in first job are more likely to return.

Email follow-up timing affects repeat probability.

Talent liquidity affects repeat purchase.

This is where the power is.

🏗 What You Need Structurally

You now need two things.

1️⃣ Company-Level Lifecycle Table

Per company:

company_id
signup_date
acquisition_channel
first_purchase_date
second_purchase_date
third_purchase_date
total_revenue_120d
days_between_purchases
job_category
geo


This lets you model:

Probability(second purchase | first purchase context)

Revenue distribution over 120 days

2️⃣ Company Cohort Summary Table

For AI training:

cohort_id
cohort_size
first_purchase_rate_30d
repeat_purchase_rate_120d
revenue_30d
revenue_120d
reward_120d


Now you have:

Short-term performance

Long-term repeat signal

Clean reward

🚀 What The AI CEO Actually Optimizes

It does not maximize:

Month 1 revenue

It maximizes:

Revenue from companies that repeat.

Which mathematically means:

𝐸
𝑥
𝑝
𝑒
𝑐
𝑡
𝑒
𝑑
𝑅
𝑒
𝑣
𝑒
𝑛
𝑢
𝑒
=
𝑃
(
𝑓
𝑖
𝑟
𝑠
𝑡
 
𝑝
𝑢
𝑟
𝑐
ℎ
𝑎
𝑠
𝑒
)
×
[
𝑉
𝑎
𝑙
𝑢
𝑒
𝑓
𝑖
𝑟
𝑠
𝑡
+
𝑃
(
𝑟
𝑒
𝑝
𝑒
𝑎
𝑡
)
×
𝑉
𝑎
𝑙
𝑢
𝑒
𝑟
𝑒
𝑝
𝑒
𝑎
𝑡
]
ExpectedRevenue=P(first purchase)×[Value
first
	​

+P(repeat)×Value
repeat
	​

]

That second probability term is everything.

🧠 Important Insight

Your marketplace’s real asset is:

Companies who repeatedly hire through you.

The AI must:

Increase the fraction of companies who repeat.

Increase the revenue per repeat buyer.

Reduce time between purchases.

Maintain liquidity so hiring succeeds.

🔁 So How Does This Change Training?

Instead of cohort-month MRR modeling, you train:

Model A:

Probability(first purchase within 30 days)

Model B:

Probability(repeat purchase within 120 days)

Model C:

Expected revenue conditional on repeat

Then combine them into:

𝐸
𝑥
𝑝
𝑒
𝑐
𝑡
𝑒
𝑑
120
𝑑
𝑉
𝑎
𝑙
𝑢
𝑒
Expected120dValue

That becomes reward.

⚖️ Why Not Optimize LTV?

Because your LTV is dominated by repeat behavior.
And repeat behavior happens in 2–4 month window.
So 120d is sufficient for training.

Later you can validate longer windows.

🎯 Final Alignment

Your AI CEO objective is:

🔵 Maximize 120-Day Gross Profit from Newly Acquired Companies

While maintaining marketplace liquidity thresholds.

That aligns with:

Transaction-heavy model

Repeat purchase focus

Marketplace physics

Fast feedback loop

Growth through quality

Now here’s the critical next question:

Do you currently have:

Company-level purchase history?

Or only daily aggregates?

Because without company-level history, you cannot model repeat behavior correctly.

Okay so what do i need to instruct my cursor AI to build table / view wise?

You want Cursor-AI instructions that produce the tables/views you need to train a CEO-style decision system for a transaction-heavy job marketplace where the real value is repeat company purchases months later.

Below is a clean, implementable BigQuery spec you can hand to Cursor. It’s designed to work from your existing daily snapshot + Stripe raw events, and it creates a “decision-grade” dataset.

What to tell Cursor to build (minimum viable data model)
0) Assumptions (Cursor should confirm by inspecting your schemas)

You have Stripe raw charges table (you referenced marketing_ai.raw_stripe) with:

created timestamp, status, amount, currency, customer, maybe metadata, description, invoice, etc.

You have a way to map Stripe customer/charge to an internal company_id (or at least an email/domain).
If you don’t, Cursor should still build everything possible and leave a TODO mapping layer.

You have a daily snapshot table (or can materialize it) similar to your JSON, ideally one row per day with the funnel fields.

A) Canonical tables to create
1) marketplace.daily_state

Purpose: the “world state” the AI observes daily (market liquidity + funnels + revenue).

Grain: date

Columns (derive from your JSON fields):

traffic: sessions, engaged_sessions, engagement_rate_pct, etc.

sources: direct_sessions, organic_sessions, referral_sessions, paid_search_sessions, paid_pmax_sessions, email_sessions, …

talent funnel: talent_signups, applications, profile_views, reviews, …

company funnel: company_signups, purchases (if you keep it), jobs_posted, job_views, apps_per_job

stripe: daily_revenue, successful_transactions, transactions_by_price (optional as JSON)

optional: a few computed ratios: revenue_per_session, company_purchase_conversion_pct

Why: this is your base state signal and a control constraint (liquidity).

Cursor instruction: “Create a BigQuery table marketplace.daily_state partitioned by date. Populate it from the existing snapshot source; if snapshot exists as JSON, build a parsing step to flatten into columns.”

2) marketplace.company_dim

Purpose: stable company identity and signup date for cohorting.

Grain: company_id

Columns:

company_id

company_signup_date

company_geo (if known)

company_source_channel (if you have attribution at signup)

company_domain or email_domain (if available)

optional: acquisition_campaign_cluster, landing_page_group

Why: repeat purchase modeling depends on company-level identity.

Cursor instruction: “Create company_dim from your app DB export or existing table. If no table exists, create an empty shell + write a TODO query to backfill from signups table.”

3) marketplace.company_purchases

Purpose: ground truth company-level purchase history (for repeat behavior).

Grain: one row per purchase (Stripe charge)

Columns:

purchase_id (charge id)

company_id (joined/mapped)

purchase_ts, purchase_date

amount_usd

price_point (e.g., 49, 99, 149, 199)

product_type = job_post vs subscription (best effort)

status (succeeded/failed)

source_system = 'stripe'

How:

Filter Stripe to succeeded charges

Normalize amounts

Classify product_type using price points and/or metadata/description

Cursor instruction: “Build company_purchases from marketing_ai.raw_stripe by filtering succeeded charges. Add heuristics to classify job_post vs subscription from amount/description/metadata. Partition by purchase_date.”

4) marketplace.company_purchase_features

Purpose: per-company lifecycle features used for training.

Grain: company_id × as_of_date (optional) or just company summary.

Start with a company-level summary table:

Columns:

company_id

signup_date

first_purchase_date

first_purchase_amount

has_first_purchase_30d (bool)

revenue_30d_from_signup

revenue_120d_from_signup

purchases_30d

purchases_120d

repeat_purchase_120d (bool: purchases >=2 within 120d)

days_to_first_purchase

days_to_second_purchase (nullable)

days_between_first_second (nullable)

Cursor instruction: “Create a materialized table computing these features by joining company_dim to company_purchases and using window functions + date diffs.”

B) Training views (what the AI CEO learns from)
5) marketplace.cohort_week_company_value

Purpose: decision-grade cohort training labels.

Grain: cohort_week × acquisition attributes (as available)

Cohort key (minimum):

cohort_week = DATE_TRUNC(company_signup_date, WEEK(MONDAY))

channel (if known; else ‘unknown’)

geo (if known)

Columns:

cohort_size

first_purchase_rate_30d

repeat_purchase_rate_120d

revenue_30d

revenue_120d

cac_30d (if you have spend by channel)

reward_120d = revenue_120d − CAC (if CAC is available; else revenue_120d only)

plus marketplace context features averaged over the signup week:

avg_apps_per_job_week

avg_jobs_posted_week

avg_talent_signups_week

Why: This teaches “which acquisition contexts produce repeat buyers,” not just month-1 revenue.

Cursor instruction: “Build a cohort-week view aggregating company_purchase_features by cohort_week/channel/geo, and join in weekly aggregates from daily_state.”

6) marketplace.policy_training_dataset_v1

Purpose: one row per decision period that a planner can learn from.

Grain: cohort_week × channel (or daily if you prefer)

Columns:

state at time of decision (liquidity + demand/supply)

actions taken (spend by channel, email pushes, promo flags, product changes)

outcome label (reward_120d for cohorts that have matured)

This is what you train your “CEO brain” on.

Cursor instruction: “Create a view that, for each cohort_week/channel, includes (a) marketplace weekly state features from daily_state, (b) action features from ad spend/email/job promo logs (if available), and (c) the matured reward_120d label once 120 days have passed.”

C) Action/event tables (critical for “AI instructs actions”)

You need at least one action log table, even if it’s coarse.

7) marketplace.actions_daily

Grain: date × action_scope

Columns (minimum):

date

paid_search_spend, pmax_spend, etc. (you currently don’t have cost in the JSON — add from Google Ads spend source)

emails_sent

promo_active, promo_depth

feature_flags (or releases) active

optionally: job_credit_discount, employer_pricing_change

Cursor instruction: “Create actions_daily from your marketing spend sources + release/promo logs. If some sources don’t exist, create placeholders and wire them later.”

Then when you build cohort_week datasets, you join action features over the cohort’s acquisition window (e.g., signup week).

D) Concrete Cursor prompt you can paste

Here is a paste-ready instruction (edit dataset names):

Cursor prompt:
“In BigQuery, create a minimal marketplace training schema for a transaction-heavy job marketplace where 90% revenue is one-time job ad purchases. Build tables/views:

marketplace.daily_state (date-partitioned) from existing daily snapshot source; flatten key fields (sessions, channel sessions, talent_signups, company_signups, jobs_posted, apps_per_job, stripe_daily_revenue, transactions counts).

marketplace.company_dim with company_id and company_signup_date (use existing signups table if present; otherwise create shell + TODO).

marketplace.company_purchases from marketing_ai.raw_stripe (succeeded charges only), normalize amount to USD, classify product_type job_post vs subscription by amount/metadata, and map to company_id if possible. Partition by purchase_date.

marketplace.company_purchase_features as a materialized table computing per-company: first_purchase_date, has_first_purchase_30d, revenue_30d_from_signup, revenue_120d_from_signup, purchases_30d, purchases_120d, repeat_purchase_120d (>=2 purchases within 120d), days_to_first_purchase, days_to_second_purchase, days_between_first_second.

marketplace.cohort_week_company_value view aggregating by cohort_week (signup week) × channel × geo: cohort_size, first_purchase_rate_30d, repeat_purchase_rate_120d, revenue_30d, revenue_120d, and join weekly marketplace context from daily_state (avg_apps_per_job_week, avg_jobs_posted_week, avg_talent_signups_week).

Create marketplace.actions_daily table (date) with spend/email/promo/release flags; if sources missing, create nullable columns now.

Create marketplace.policy_training_dataset_v1 view combining cohort_week_company_value + actions aggregated over signup week, and include label reward_120d (revenue_120d - CAC if CAC available).
Use partitioning/clustering where appropriate, write SQL DDL + queries, and include comments explaining assumptions and TODOs for missing mapping between Stripe customer and company_id.”

One critical blocker Cursor must resolve

To train repeat purchasing, you need company_id on Stripe charges.

If you don’t have that mapping today, the quickest fix is usually one of:

Stripe customer.email / billing_email joined to company signup email

metadata on charges (e.g., company_id, job_id)

invoice line items referencing your internal job post id

If none of that exists, you’ll need to add it going forward, but Cursor can still build everything else and label purchases at aggregate level.