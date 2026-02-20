# Metrics Grouping & Mapping (Stage-Based)

This document maps all metrics from the `reporting-metrics` API endpoint organized by customer journey stage for a jobsite marketplace.

**API Endpoint:** `GET /api/bigquery/reporting-metrics?granularity={daily|weekly|monthly}&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

---

## API Response Structure

```json
{
  "rows": [
    {
      "date": "2026-01-31",
      "sessions": 1234,
      "new_users": 450,
      "talent_signups": 15,
      "talent_signup_rate_pct": 3.33,
      "company_signups": 4,
      "company_signup_rate_pct": 0.89,
      "jobs_posted": 8,
      "stripe_revenue": 2500.00,
      "job_views": 850,
      "applications": 120,
      "apps_per_job": 15.0,
      "hires": 2,
      "app_to_hire_pct": 1.67,
      ...
    },
    ...
  ],
  "granularity": "daily"
}
```

### Response Fields

- **`rows`**: Array of metric objects, one per period (day/week/month based on granularity)
- **`granularity`**: The time period for each row (`daily`, `weekly`, or `monthly`)

### Key Metrics in Each Row

Each row contains all metrics for that period, including:
- Traffic metrics (`sessions`, `new_users`, `engaged_sessions`, etc.)
- Signup metrics (`talent_signups`, `company_signups`, conversion rates)
- Job metrics (`jobs_posted`, `job_views`, `applications`, `apps_per_job`)
- Revenue metrics (`stripe_revenue`, `revenue`, `mrr`, `arr`)
- Hiring metrics (`hires`, `app_to_hire_pct`, `match_rate_pct`)
- Marketing channel breakdowns (organic, paid, social, email, etc.)

---

## Stage 1: Attract (Marketing)

How visitors discover the platform through various marketing channels.

### Paid Advertising
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `paid_search_sessions` | Paid Search Sessions | number | Sessions from paid search |
| `paid_pmax_sessions` | PMax Sessions | number | Sessions from Performance Max |
| `total_paid_sessions` | Total Paid Sessions | number | All paid traffic sessions |
| `paid_pct` | Paid % | percent | Paid as % of total |
| `paid_search_engaged_sessions` | Paid Search Engaged | number | Engaged paid search sessions |
| `paid_pmax_engaged_sessions` | PMax Engaged | number | Engaged PMax sessions |
| `paid_engagement_rate` | Paid Engagement Rate | percent | Engagement rate for paid traffic |
| `gads_sessions` | Google Ads Sessions | number | Sessions from Google Ads |
| `gads_users` | Google Ads Users | number | Users from Google Ads |
| `gads_conversions` | Google Ads Conversions | number | Conversions from Google Ads |
| `gads_revenue` | Google Ads Revenue | currency | Revenue attributed to Google Ads |
| `gads_pmax_sessions` | GAds PMax Sessions | number | Google Ads PMax sessions |
| `gads_pmax_conversions` | GAds PMax Conversions | number | Conversions from PMax |
| `gads_search_sessions` | GAds Search Sessions | number | Google Ads Search sessions |
| `gads_search_conversions` | GAds Search Conversions | number | Conversions from Search |

### Organic & SEO
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `organic_sessions` | Organic Sessions | number | Sessions from organic search |
| `organic_pct` | Organic % | percent | Organic sessions as % of total |
| `organic_engaged_sessions` | Organic Engaged Sessions | number | Engaged sessions from organic |
| `organic_engagement_rate` | Organic Engagement Rate | percent | Engagement rate for organic traffic |

### Social
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `social_sessions` | Social Sessions | number | Sessions from social media platforms |

### Email Marketing
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `email_traffic_sessions` | Email Traffic Sessions | number | Sessions from email campaigns |
| `campaigns_launched` | Campaigns Launched | number | Number of email campaigns sent |
| `email_daily_opens` | Daily Opens | number | Email opens for the period |
| `email_daily_clicks` | Daily Clicks | number | Email clicks for the period |
| `email_daily_unique_openers` | Unique Openers | number | Unique users who opened emails |
| `email_daily_unique_clickers` | Unique Clickers | number | Unique users who clicked emails |
| `campaign_lifetime_sends` | Lifetime Sends | number | Total campaign sends (cumulative) |
| `campaign_lifetime_opens` | Lifetime Opens | number | Total campaign opens (cumulative) |
| `campaign_lifetime_clicks` | Lifetime Clicks | number | Total campaign clicks (cumulative) |
| `campaign_avg_open_rate` | Avg Open Rate | percent | Average email open rate across campaigns |
| `campaign_avg_ctr` | Avg CTR | percent | Average click-through rate |
| `campaign_click_to_open_pct` | Click-to-Open % | percent | Clicks as % of opens |
| `email_contacts_total` | Total Contacts | number | Total email contacts in system |
| `email_list_subscribers_total` | Total Subscribers | number | Total email subscribers |

### Referral & Direct
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `referral_sessions` | Referral Sessions | number | Sessions from referrals |
| `referral_pct` | Referral % | percent | Referral as % of total |
| `direct_sessions` | Direct Sessions | number | Direct traffic sessions |
| `direct_pct` | Direct % | percent | Direct as % of total |

### Content (Marketing Pages)
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `blog_pageviews` | Blog Pageviews | number | Total pageviews for /blog pages (GA4) |
| `forum_pageviews` | Forum Pageviews | number | Total pageviews for /forum pages (GA4) |
| `marketing_page_views` | Marketing Page Views | number | Total views across all marketing content pages |

_Note: Blog/Forum metrics need to be added to the reporting table if not present._

### Overall Traffic Metrics
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `sessions` | Total Sessions | number | All website sessions |
| `new_users` | New Visitors | number | First-time visitors (GA4) - used for signup conversion rates |
| `engaged_sessions` | Engaged Sessions | number | Sessions with engagement |
| `engagement_rate_pct` | Engagement Rate % | percent | Overall engagement rate |
| `video_sessions` | Video Sessions | number | Sessions from video sources |
| `total_events` | Total Events | number | All GA4 events |
| `events_per_session` | Events per Session | number | Average events per session |
| `key_events` | Key Events | number | Important conversion events |

---

## Stage 2: Signup

Converting visitors to registered users (two-sided marketplace).

### Talent (Supply Side)
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `talent_signups` | Talent Signups | number | New talent registrations (period) |
| `cumulative_talent_signups` | Cumulative Talent | number | Total talent signed up (all-time) |
| `talent_signup_rate_pct` | Talent Signup Rate % | percent | Talent signups / (new_users - company_signups) * 100 |

_Note: `cumulative_talent_signups` needs to be added to the reporting table if not present._

### Companies (Demand Side)
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `company_signups` | Company Signups | number | New company registrations (period) |
| `cumulative_company_signups` | Cumulative Companies | number | Total companies signed up (all-time) |
| `company_signup_rate_pct` | Company Signup Rate % | percent | Company signups / (new_users - talent_signups) * 100 |

### Combined Metrics
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `total_signups` | Total Signups | number | All new signups (talent + company) |
| `overall_signup_rate_pct` | Overall Signup Rate % | percent | Total signups / new_users * 100 |

---

## Stage 3: Engage (Marketplace Activity)

Core engagement: posting jobs, applying, and hiring.

### Jobs
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `jobs_posted` | Jobs Posted | number | New job listings created (period) |
| `job_views` | Job Views | number | Job listing page views |

### Applications
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `applications` | Applications | number | Job applications submitted |
| `apps_per_job` | Apps per Job | number | Average applications per job |
| `profile_views` | Profile Views | number | Talent profile page views |

### Hires & Matches
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `hires` | Hires | number | Successful hires completed |
| `match_rate_pct` | Match Rate % | percent | Jobs with hires / jobs posted |
| `app_to_hire_pct` | App to Hire % | percent | Hires / applications |
| `reviews` | Reviews | number | Reviews submitted |

---

## Stage 4: Purchase (Transactions & Revenue)

Monetization through purchases and revenue generation.

### Transactions
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `purchases` | Purchases | number | Completed purchases (period) |
| `purchasing_customers` | Purchasing Customers | number | Unique customers who purchased (period) |
| `purchases_per_customer_daily` | Purchases per Customer | number | Avg purchases per customer (period) |
| `failed_transactions` | Failed Transactions | number | Failed payment attempts |
| `cumulative_purchases` | Cumulative Purchases (Count) | number | Total number of purchases (all-time) |
| `cumulative_purchase_amount` | Cumulative Revenue (Amount) | currency | Total purchase revenue (all-time) |

_Note: `cumulative_purchase_amount` needs to be added to the reporting table if not present._

### Revenue
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `stripe_revenue` | Stripe Revenue (Total) | currency | Total revenue processed via Stripe (period) |
| `revenue` | Revenue | currency | Revenue (rolls up into Stripe Revenue) |
| `ga4_revenue` | GA4 Revenue | currency | Revenue tracked in GA4 (rolls up into Stripe Revenue) |
| `revenue_per_session` | Revenue per Session | currency | Revenue / sessions |
| `revenue_per_talent_signup` | Revenue per Talent Signup | currency | Revenue / talent signups |
| `revenue_per_hire` | Revenue per Hire | currency | Revenue / hires |

_Note: `stripe_revenue` is the source of truth for total revenue. All other revenue metrics roll up into this value._

### Conversion Metrics
| Metric Key | Label | Format | Description |
|------------|-------|--------|-------------|
| `company_purchase_conversion_pct` | Company Purchase Conv % | percent | Purchasing companies / total companies |
| `avg_purchases_per_company` | Avg Purchases per Company | number | Lifetime purchases / companies |

---

## Trend Metrics (Day-over-Day, Week-over-Week, 7-Day Averages)

These metrics show change over time and rolling averages:

### Day-over-Day (DoD) Change
| Metric Key | Description |
|------------|-------------|
| `talent_signups_dod` | Change in talent signups vs. previous day |
| `company_signups_dod` | Change in company signups vs. previous day |
| `applications_dod` | Change in applications vs. previous day |
| `revenue_dod` | Change in revenue vs. previous day |
| `sessions_dod` | Change in sessions vs. previous day |
| `purchases_dod` | Change in purchases vs. previous day |
| `stripe_revenue_dod` | Change in Stripe revenue vs. previous day |

### 7-Day Rolling Averages
| Metric Key | Description |
|------------|-------------|
| `talent_signups_7d_avg` | 7-day average talent signups |
| `company_signups_7d_avg` | 7-day average company signups |
| `applications_7d_avg` | 7-day average applications |
| `revenue_7d_avg` | 7-day average revenue |
| `sessions_7d_avg` | 7-day average sessions |
| `purchases_7d_avg` | 7-day average purchases |
| `stripe_revenue_7d_avg` | 7-day average Stripe revenue |

### Week-over-Week (WoW) % Change
| Metric Key | Description |
|------------|-------------|
| `talent_signups_wow_pct` | % change in talent signups vs. previous week |
| `revenue_wow_pct` | % change in revenue vs. previous week |
| `sessions_wow_pct` | % change in sessions vs. previous week |
| `purchases_wow_pct` | % change in purchases vs. previous week |
| `stripe_revenue_wow_pct` | % change in Stripe revenue vs. previous week |

---

## Recommended Dashboard Structure

### Stage 1: Attract (Marketing) — 7 Cards

**1. Paid Advertising**
- Total Paid Sessions, Paid Search, PMax, Paid %, Google Ads metrics

**2. Organic & SEO**
- Organic Sessions, Organic %, Engagement

**3. Social**
- Social Sessions

**4. Email Marketing - Campaigns**
- Marketing Campaigns (manual broadcasts, status=5)
- Campaigns Launched, Daily Sends, Opens, Clicks, Avg Open Rate, Avg CTR

**5. Email Marketing - Automation**
- Automation Emails (triggered/transactional, status=1)
- Campaigns Launched, Daily Sends, Opens, Clicks, Avg Open Rate, Avg CTR

**6. Referral & Direct**
- Referral Sessions, Direct Sessions, Percentages

**7. Content (Marketing Pages)**
- Blog Pageviews, Forum Pageviews

**8. Overall Traffic**
- Total Sessions, Engaged Sessions, Engagement Rate, Events

### Stage 2: Signup — 2 Cards

**9. Talent (Supply)**
- Signups, Cumulative, Signup Rate

**10. Companies (Demand)**
- Signups, Cumulative, Signup Rate

### Stage 3: Engage (Marketplace) — 3 Cards

**11. Jobs**
- Jobs Posted, Job Views

**12. Applications**
- Applications, Apps per Job, Profile Views

**13. Hires & Matches**
- Hires, Match Rate, App-to-Hire Rate, Reviews

### Stage 4: Purchase (Revenue) — 3 Cards

**14. Transactions**
- Purchases, Customers, Failed, Cumulative Count & Amount

**15. Revenue**
- Stripe Revenue, Revenue per Session/Signup/Hire

**16. Conversion**
- Purchase Conversion %, Avg Purchases per Company

---

## Notes

- **Date field varies by granularity:**
  - Daily: `date`
  - Weekly: `week_start`, `week_num`
  - Monthly: `month_start`, `month_num`

- **Format types:**
  - `number` → `1,234`
  - `currency` → `$1,234.00`
  - `percent` → `12.3%`

- **Null values:** Some metrics return `null` when denominator is zero (e.g., `apps_per_job` when `jobs_posted = 0`)

- **Metrics to add to reporting table:**
  - `cumulative_talent_signups` – All-time talent signups
  - `cumulative_purchase_amount` – All-time purchase revenue
  - `blog_pageviews` – Marketing page views for /blog
  - `forum_pageviews` – Marketing page views for /forum
  - `marketing_page_views` – Total marketing content views

- **Removed metrics** (pending proper implementation):
  - `mrr`, `arr`, `active_subscriptions`, `churned_subscriptions`, `churn_rate_pct`
  - These will be re-added once subscription and churn calculations are properly implemented
