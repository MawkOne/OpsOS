# Scout AI - Complete Specification from ChatGPT Conversation

**Source:** Original ChatGPT conversation (chatgpt_feedback.md)  
**Date Created:** January 2026  
**Status:** This is the FULL spec - compare against what's actually built

---

## 📊 METRICS REGISTRY (30+ Core Metrics)

### Performance Metrics
| Metric ID | Name | Formula | Unit | Grain |
|-----------|------|---------|------|-------|
| `m_ctr` | CTR | `clicks / NULLIF(impressions, 0)` | percent | daily_entity, campaign_daily |
| `m_cac` | CAC | `cost / NULLIF(conversions, 0)` | dollars | daily_campaign |
| `m_mer` | MER | `revenue / NULLIF(cost, 0)` | ratio | daily_total, daily_channel |
| `m_cvr` | Conversion Rate | `conversions / NULLIF(sessions, 0)` | percent | daily_entity |
| `m_email_open` | Email Open Rate | `emails_opened / NULLIF(emails_sent, 0)` | percent | daily_email |
| `m_cpa` | Cost Per Acquisition | `cost / NULLIF(conversions, 0)` | dollars | campaign_daily |
| `m_roas` | ROAS | `revenue / NULLIF(cost, 0)` | ratio | campaign_daily |
| `m_revenue_per_session` | Revenue/Session | `revenue / NULLIF(sessions, 0)` | dollars | daily_entity |
| `m_cpc` | Cost Per Click | `cost / NULLIF(clicks, 0)` | dollars | campaign_daily |
| `m_roi` | ROI | `(revenue - cost) / NULLIF(cost, 0)` | percent | daily_total |

### Entity-Level Raw Metrics
- **Traffic:** impressions, clicks, sessions, users, pageviews
- **Engagement:** avg_session_duration, bounce_rate, engagement_rate, scroll_depth
- **Conversions:** conversions, conversion_rate
- **Revenue:** revenue, cost, profit
- **Email:** sends, opens, clicks, unsubscribes, spam_complaints
- **SEO:** rank_avg, search_volume, position
- **Performance:** ctr, cpc, cpa, roas, roi

---

## ⏰ LOOKBACK WINDOWS (7 Patterns)

### Standard Windows
| Window | Period | Use Case |
|--------|--------|----------|
| **Yesterday** | 1 day | Current performance snapshot |
| **Last 7 days** | 7d trailing | Short-term baseline |
| **Last 14 days** | 14d trailing | Two-week baseline |
| **Last 28 days** | 28d trailing | Monthly baseline |
| **Last 30 days** | 30d trailing | Current period |
| **Previous 30 days** | 31-60 days back | Historical comparison |
| **Last 90 days** | 90d trailing | Long-term trends |

### Comparison Patterns
1. **1 day vs 7 day** → Anomaly detection (±20% threshold)
2. **Last 30 vs Previous 30** → Trend analysis (20%+ decline = flag)
3. **Last 7 vs baseline 28** → Recent performance shifts
4. **Same weekday prior weeks** → Seasonality detection
5. **3-7 day stability** → Scale winner validation (must be stable)

---

## 🔍 DAILY ANALYSIS JOBS (50+ Opportunity Types)

### 0) PREFLIGHT CHECKS (Data Health)

#### Job: Data Freshness & Completeness
**Frequency:** Daily, before all other jobs  
**Lookback:** Latest partition check  
**Checks:**
- Latest available date for each source (GA4, Ads, DataForSEO, Stripe, ActiveCampaign)
- Row counts vs normal (flag if < X% of expected)
- Schema changes (new/missing columns)
- Join-key null spikes (missing campaign_id, page_location, etc.)

**Thresholds:**
- Missing partition = HIGH alert
- <80% of normal rows = MEDIUM alert
- Schema change = MEDIUM alert
- >5% null keys = HIGH alert

**Output:** `data_quality_issue`

#### Job: Identity Mapping Health
**Frequency:** Daily  
**Lookback:** All time  
**Checks:**
- % of events/rows failing mapping to canonical entity_id by source
- Top unmapped source IDs by volume (clicks/spend/revenue impact)
- Growth in unmapped entities

**Thresholds:**
- Unmapped > 2-5% = flag
- Top 10 unmapped by impact

**Output:** `mapping_gap`

---

### 1) ANOMALY DETECTION (Daily Heartbeat)

#### Job: Metric Anomaly Detection
**Frequency:** Daily  
**Lookback:** 1 day vs 7d/14d baseline  
**Metrics Monitored:**
- CTR, CVR, CPA, Revenue
- Rank changes (DataForSEO)
- Email open/click rates
- Spend spikes without conversion lift
- Bounce rate, engagement time

**Detection Logic:**
- Compare yesterday vs trailing 7d avg
- Compare yesterday vs trailing 14d avg
- Flag deviations beyond threshold
- Methods: ±20%, z-score, IQR

**Thresholds:**
- ±20% = MEDIUM alert
- ±40% = HIGH alert
- Z-score > 2 = flag
- IQR outlier = flag

**Output:** `anomaly_detection`

**Confidence Scoring:**
```
confidence = 0.5 + (0.5 * min(1.0, data_volume / 1000))
if stable_for_days > 3: confidence += 0.2
if multiple_sources_confirm: confidence += 0.1
```

---

### 2) FUNNEL & REVENUE ANALYSIS

#### Job 2A.1: Revenue Anomalies
**Frequency:** Daily  
**Lookback:** 1 day vs 7d/28d baseline  
**Data Sources:** Stripe, GA4  
**Checks:**
- Total revenue (gross, net if available)
- New subscriptions / purchases
- Refunds / chargebacks
- MRR / ARR deltas (if subscription)

**Thresholds:**
- Revenue drop > 20% vs 7d = HIGH
- Revenue spike > 50% vs 7d = MEDIUM (investigate)
- Refund rate > 5% = HIGH
- Refund rate increase > 2x = HIGH

**Outputs:** `revenue_anomaly`, `refund_spike`

#### Job 2A.2: Conversion Rate & Lead Flow Anomalies
**Frequency:** Daily  
**Lookback:** 1 day vs 7d/28d  
**Data Sources:** GA4  
**Checks:**
- Sessions/users
- Primary conversion count (trial_start / purchase / book_call)
- Conversion rate
- New user conversion rate

**Thresholds:**
- CVR drop > 20% with stable traffic = HIGH
- Traffic drop > 30% = HIGH
- New user CVR < 50% of returning = flag

**Outputs:** `cvr_drop`, `traffic_drop`

#### Job 2A.3: Source/Medium Mix Shift
**Frequency:** Daily  
**Lookback:** 7d window  
**Data Sources:** GA4  
**Checks:**
- Share of sessions by channel (paid_search, organic, email, direct, referral)
- Share of conversions by channel
- Cost per conversion by channel

**Detection:**
- Identify channel share shifts that explain revenue/CVR changes
- Example: Organic drops 20%, paid increases 15% → explains CVR drop if paid converts worse

**Thresholds:**
- Channel share shift > 15% = flag if explains anomaly

**Output:** `channel_mix_shift`

---

### 3) PAID SEARCH (Google Ads)

#### Job 3B.1: Scale Winners (Budget Reallocation)
**Frequency:** Daily  
**Lookback:** Last 7 days (must be stable 3-7 days)  
**Data Sources:** Google Ads, Stripe  
**Logic:**
```sql
-- Find campaigns/ad groups/keywords with:
1. MER/ROAS above baseline (site avg or channel avg)
2. Stable for 3-7 days (not a one-day spike)
3. CPA below target
4. Volume not capped (impression share lost to budget > 20%)
```

**Thresholds:**
- MER > baseline + 30% = HIGH priority
- MER > baseline + 50% = TOP priority
- Stable for 7 days = confidence boost
- Impression share lost to budget > 20% = can scale

**Recommended Actions:**
- Budget increase within caps (10-20% increase)
- Bid increase (5-10%)
- Expand to similar audiences

**Guardrails:**
- Max daily budget cap
- Min MER threshold (e.g., 3.5x)
- Max CPA cap (e.g., $120)

**Output:** `scale_winner`

#### Job 3B.2: Waste / Leakage (Stop Bleeding)
**Frequency:** Daily  
**Lookback:** Last N days/clicks (configurable, default 30 days)  
**Data Sources:** Google Ads  
**Checks:**
- Spend > threshold with 0 conversions (e.g., $50+ spent, 0 conv)
- Rising CPA vs baseline
- Falling ROAS vs baseline
- High clicks + low landing page CVR

**Thresholds:**
- $50+ spent, 0 conv after 100+ clicks = PAUSE candidate
- CPA > $200 or 2x baseline = HIGH priority fix
- ROAS < 2.0 or < 50% baseline = HIGH priority
- Clicks > 50, landing CVR < 1% = landing page issue

**Recommended Actions:**
- Pause campaign/ad group
- Add negative keywords
- Tighten match type (broad → phrase → exact)
- Fix landing page or reroute traffic

**Outputs:** `paid_waste`, `paid_cpa_spike`, `paid_clicks_low_cvr`

#### Job 3B.3: Search Term Mining (Growth Expansion)
**Frequency:** Daily  
**Lookback:** Last 30 days  
**Data Sources:** Google Ads search terms report  
**Logic:**
```sql
-- Find search queries that:
1. Have conversions (1+ conv)
2. Not in exact match keywords
3. Not in dedicated ad group
4. CPA below target
```

**Rank By:** conversions DESC, then revenue DESC, then CPA ASC

**Recommended Actions:**
- Add exact match keywords
- Create new ad groups for high-volume terms
- Add negatives for irrelevant high-spend terms

**Thresholds:**
- 3+ conversions = add to exact match
- 10+ clicks with relevant intent = add to phrase match
- High spend + irrelevant = negative keyword

**Outputs:** `query_mining_expand`, `query_mining_negatives`

#### Job 3B.4: Creative Fatigue / Ad Strength Issues
**Frequency:** Daily  
**Lookback:** 7d vs 28d baseline  
**Data Sources:** Google Ads  
**Checks:**
- CTR down vs baseline for same entity
- Impressions stable/up, clicks down
- Ad strength score (if available)

**Thresholds:**
- CTR drop > 20% with stable impressions = refresh needed
- Ad strength < 3/5 = optimization needed

**Recommended Actions:**
- New RSA headlines/descriptions
- Rotate assets
- Test new creatives
- Update ad extensions

**Output:** `ad_creative_refresh`

#### Job 3B.5: Brand Defense + Cannibalization
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Google Ads, DataForSEO  
**Checks:**
- Brand campaign impression share loss
- CPC spikes on brand terms
- Organic rank stable but paid brand off (or vice versa)

**Detection:**
- Cross-reference organic rank for brand terms
- If rank #1 organically AND paid CPC high = potential waste
- If competitors appear above organic = defense needed

**Thresholds:**
- Brand impression share < 80% = flag
- Brand CPC increase > 50% = investigate
- Competitor above organic brand = HIGH priority

**Output:** `brand_defense_signal`

---

### 4) SEO (DataForSEO + GA4)

#### Job 4C.1: "Striking Distance" Keywords
**Frequency:** Daily check, weekly full analysis  
**Lookback:** Current rank position, 30d CVR  
**Data Sources:** DataForSEO, GA4, Stripe  
**Logic:**
```sql
-- Find keywords:
1. Ranking positions 4-15 (below fold but close)
2. Business intent signals (buy, best, vs, pricing, etc.)
3. Landing page converts above site avg when they DO land
4. Search volume > threshold
```

**Business Intent Signals:**
- Buy, best, top, vs, comparison, pricing, cost, review, for [business type]

**Thresholds:**
- Rank 4-10 = HIGH priority (page 1)
- Rank 11-15 = MEDIUM priority (page 2 top)
- Landing CVR > 2x site avg = confidence boost
- Search volume > 100/month = prioritize

**Recommended Actions:**
- Refresh page content
- Add internal links
- Expand section
- Improve title/meta for CTR
- Add schema markup

**Output:** `seo_striking_distance`

#### Job 4C.2: Rank Drops on Money Terms/Pages
**Frequency:** Daily  
**Lookback:** Today vs yesterday, 7d, 30d  
**Data Sources:** DataForSEO, GA4, Stripe  
**Checks:**
- Keywords/pages with rank drop > X positions
- Focus on top revenue pages
- Focus on high-volume terms

**Thresholds:**
- Rank drop > 5 positions = MEDIUM alert
- Rank drop > 10 positions = HIGH alert
- Top 10 revenue page drops > 3 positions = HIGH alert
- Drop from page 1 to page 2 = HIGH alert

**Recommended Actions:**
- Investigate SERP changes
- Check page changes (recent deploys)
- Analyze competitors
- Technical SEO audit
- Content refresh

**Output:** `seo_rank_drop_urgent`

#### Job 4C.3: High Impressions + Low CTR
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** Google Search Console (if available), DataForSEO + GA4  
**Checks:**
- Pages/keywords with stable rank but declining traffic
- High SERP impressions but low clicks
- Title/meta mismatch with intent

**Thresholds:**
- Rank stable, traffic drop > 20% = title/meta issue
- CTR < 2% for top 5 positions = opportunity
- CTR < 50% of expected for position = optimize

**Recommended Actions:**
- Rewrite title/meta
- Align with search intent
- Add rich snippet content
- Improve SERP snippet appeal

**Output:** `seo_ctr_opportunity`

#### Job 4C.4: Content Gap / Topic Expansion
**Frequency:** Daily  
**Lookback:** 30d performance  
**Data Sources:** GA4, DataForSEO, Stripe  
**Logic:**
```sql
-- Find topics/pages:
1. Driving conversions
2. Adjacent keywords with volume + similar intent exist
3. Not covered by existing content
```

**Detection:**
- Identify high-performing content topics
- Use keyword clustering to find related terms
- Check coverage (existing pages for those terms)
- Prioritize by search volume × CVR

**Recommended Actions:**
- Create new pages/sections
- Add internal links
- Expand existing content
- Create topic clusters

**Output:** `seo_content_expand`

---

### 5) EMAIL (ActiveCampaign)

#### Job 5D.1: Scale Winners
**Frequency:** Daily  
**Lookback:** Last 30 days  
**Data Sources:** ActiveCampaign, GA4, Stripe  
**Checks:**
- Campaigns/automations with high revenue per recipient
- High CTR
- High downstream conversion

**Thresholds:**
- Revenue per recipient > 2x baseline = scale candidate
- CTR > 5% = high engagement
- Downstream CVR > 3% = effective

**Recommended Actions:**
- Resend to non-openers
- Expand segment
- Replicate template/structure
- Increase frequency (with guardrails)

**Output:** `email_scale_winner`

#### Job 5D.2: Subject Line / Deliverability Warning
**Frequency:** Daily  
**Lookback:** 7d vs 28d baseline  
**Data Sources:** ActiveCampaign  
**Checks:**
- Open rate drop vs baseline (by list/segment)
- Unsubscribe rate increase
- Spam complaint increase

**Thresholds:**
- Open rate drop > 15% = HIGH priority
- Unsubscribe rate > 1% = investigate
- Spam complaints > 0.1% = HIGH priority

**Recommended Actions:**
- Subject line testing
- List hygiene
- Reduce frequency
- Investigate deliverability (SPF, DKIM, DMARC)
- Re-engagement campaign

**Outputs:** `email_open_drop`, `email_deliverability_risk`

#### Job 5D.3: High Opens, Low Clicks (Copy/CTA Problem)
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** ActiveCampaign  
**Checks:**
- Open rate stable or high
- CTR down vs baseline

**Thresholds:**
- Open rate > 20%, CTR < 2% = CTA issue
- CTR drop > 30% with stable opens = copy issue

**Recommended Actions:**
- Rewrite body copy
- Simplify CTA
- Reduce friction
- Add single primary CTA (vs multiple)
- Improve CTA design/placement

**Output:** `email_click_leak`

#### Job 5D.4: High Clicks, Low Downstream Conversion
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** ActiveCampaign, GA4  
**Checks:**
- Email click → GA4 sessions on landing page
- Landing page CVR

**Detection:**
```sql
-- Join email clicks to GA4 sessions (UTM match)
-- Compare landing page CVR for email traffic vs organic
```

**Thresholds:**
- Email traffic CVR < 50% of organic traffic CVR = mismatch
- CTR > 3% but CVR < 1% = landing issue

**Recommended Actions:**
- Adjust landing page message match
- Reduce steps to conversion
- Add social proof
- Match email promise to landing page

**Output:** `email_to_lp_mismatch`

#### Job 5D.5: Lifecycle Triggers (Stripe-led)
**Frequency:** Daily  
**Lookback:** +1/+2 days after event  
**Data Sources:** Stripe, GA4, ActiveCampaign  
**Checks:**
- New trials started yesterday without activation event by day+1/+2
- Churn-risk segments (usage drop, engagement drop)
- Payment failures

**Detection:**
- Trial start event but no key activation events
- Active user → inactive (no activity 7+ days)
- Payment failed event

**Thresholds:**
- Trial day 1 no activation = trigger onboarding
- Trial day 3 no activation = HIGH priority
- 7 days inactive = re-engagement campaign
- Payment failed = dunning sequence

**Recommended Actions:**
- Trigger/adjust onboarding sequence
- Winback email sequence
- In-app message
- Support outreach

**Outputs:** `lifecycle_activation_gap`, `winback_trigger`

---

### 6) WEBSITE / LANDING PAGES

#### Job 6E.1: High Traffic, Low Conversion Pages
**Frequency:** Daily  
**Lookback:** 7d/28d  
**Data Sources:** GA4, Stripe  
**Logic:**
```sql
-- For each page:
SELECT 
  page,
  sessions_7d,
  conversions_7d,
  cvr,
  revenue,
  peer_avg_cvr (same template/type)
WHERE sessions_7d > threshold
  AND cvr < peer_avg_cvr * 0.8
ORDER BY (peer_avg_cvr - cvr) * sessions_7d DESC
```

**Thresholds:**
- Sessions > 100/week AND CVR < peer avg -20% = opportunity
- High traffic (top 20%) + bottom 30% CVR = HIGH priority

**Recommended Actions:**
- Launch A/B test (headline, CTA, social proof)
- Shorten form
- Add trust signals
- Improve page speed
- Heatmap analysis

**Output:** `lp_cvr_opportunity`

#### Job 6E.2: Funnel Step Drop-offs
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** GA4 events  
**Checks:**
```
For defined funnels:
- landing → signup → trial → purchase
- pricing → checkout → purchase
- demo → trial → onboarding → activated

Compute step-to-step CVR
Compare to baseline
```

**Thresholds:**
- Single step drop > 30% below baseline = HIGH priority
- Step CVR < 50% when others > 70% = bottleneck
- Regression after recent change = HIGH alert

**Recommended Actions:**
- Targeted fix at drop-off step
- Remove friction
- A/B test changes
- Add progress indicators

**Output:** `funnel_dropoff`

#### Job 6A.3: Paid Traffic Mismatch
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Google Ads, GA4  
**Checks:**
- Pages receiving paid traffic
- Paid CVR vs organic CVR for same page
- Cost per conversion

**Thresholds:**
- Paid CVR < 50% of organic CVR = mismatch
- Cost/conversion increasing while page unchanged = optimize
- Paid CPA > 2x organic = investigate

**Recommended Actions:**
- Create paid-specific landing page
- Message match adjustment
- Reroute traffic to higher-CVR page
- Match ad promise to landing

**Output:** `paid_to_page_mismatch`

#### Job 6A.4: Email Traffic Landing on Weak Pages
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** ActiveCampaign, GA4  
**Checks:**
- Email clicks → landing pages
- CVR and revenue/session of those pages

**Thresholds:**
- Email CTR > 3% but landing CVR < 2% = mismatch
- Email traffic CVR < organic CVR = landing issue

**Output:** `email_landing_page_mismatch`

#### Job 6A.5: Page Engagement Decay (Early Warning)
**Frequency:** Daily  
**Lookback:** 7d vs 28d  
**Data Sources:** GA4  
**Checks:**
- Avg engagement time
- Bounce rate
- Scroll depth (if available)

**Detection:**
- Engagement drops BEFORE CVR drops (leading indicator)

**Thresholds:**
- Engagement time drop > 20% = warning
- Bounce rate increase > 15% = warning
- Scroll depth drop > 20% = warning

**Output:** `page_engagement_decay`

---

### 7) CONTENT (Blog, Guides, Educational)

#### Job 7B.1: Content Driving Conversions (Scale It)
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** GA4, Stripe  
**Checks:**
- Assisted conversions by content page
- Revenue attribution (direct or assisted)
- CVR vs content average

**Thresholds:**
- Assisted conv > 10 in 30d = scale candidate
- CVR > 2x content avg = HIGH value
- Revenue attribution > $1k/month = prioritize

**Recommended Actions:**
- Internal linking expansion
- Topic cluster expansion
- Paid amplification
- Email feature
- Update and re-promote

**Output:** `content_scale_winner`

#### Job 7B.2: High-Ranking Content Not Converting
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** DataForSEO, GA4  
**Checks:**
- Top-ranking pages (pos 1-5)
- Sessions high
- Conversion rate low

**Thresholds:**
- Rank 1-5 + sessions > 500/month + CVR < 1% = opportunity
- Intent mismatch likely
- Weak/missing CTA

**Recommended Actions:**
- Add clear CTA
- Intent alignment (info → commercial)
- Lead magnet offer
- Exit-intent popup
- Retargeting for non-converters

**Output:** `content_conversion_gap`

#### Job 7B.3: Content Decay Detection (Silent Killer)
**Frequency:** Daily  
**Lookback:** 30d vs 90d  
**Data Sources:** GA4, DataForSEO  
**Checks:**
- Historically strong pages
- Traffic trend declining
- Rank trend declining
- Conversion trend declining

**Thresholds:**
- Traffic drop > 30% over 90 days = decay
- Rank drop > 5 positions = decay
- Competitors overtaking = HIGH priority

**Recommended Actions:**
- Content refresh (update stats, examples)
- Technical SEO audit
- Improve E-A-T signals
- Add new sections
- Competitor analysis

**Output:** `content_decay`

#### Job 7B.4: Striking-Distance Content Expansion
**Frequency:** Daily / weekly hybrid  
**Lookback:** Current rankings  
**Data Sources:** DataForSEO, GA4  
**Checks:**
- Keywords ranking 4-15
- Business intent
- Existing page partially covers topic

**Thresholds:**
- Rank 4-10 with business intent = HIGH priority
- Partial content (300-500 words) = expansion opportunity

**Recommended Actions:**
- Update existing content (add 1000+ words)
- Add sections for related keywords
- Create supporting article
- Internal link from authority pages

**Output:** `content_striking_distance`

#### Job 7B.5: Content Gap from Paid & Email Data
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** Google Ads search terms, ActiveCampaign, GA4  
**Checks:**
- Paid search queries converting
- Email CTAs converting
- Topics not covered by content

**Detection:**
```sql
-- Find converting paid queries with no SEO content coverage
-- Find email topics with high CTR but no content follow-up
```

**Output:** `content_gap_from_demand`

---

### 8) SOCIAL (Organic + Distribution)

#### Job 8C.1: High-Engagement Posts with No Site Leverage
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Social platforms (API), GA4  
**Checks:**
- Social posts with engagement > baseline
- No downstream traffic or conversion

**Thresholds:**
- Engagement > 2x avg but 0 link clicks = missed opportunity
- High engagement but no CTA = add follow-up

**Recommended Actions:**
- Add follow-up post with CTA
- Repurpose into content/email/ad
- Add link in comments
- Create landing page for topic

**Output:** `social_engagement_unleveraged`

#### Job 8C.2: Social Posts Driving Traffic But Not Converting
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Social platforms, GA4  
**Checks:**
- Sessions by social post / campaign
- CVR of landing page

**Thresholds:**
- Social traffic present but CVR < 1% = mismatch
- Social CVR < 50% of organic = landing issue

**Output:** `social_to_page_mismatch`

#### Job 8C.3: Topic Resonance Detection (Content Ideation)
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Social platforms  
**Checks:**
- Engagement by topic/theme
- Comments sentiment (if available)
- Repeat engagement patterns

**Detection:**
- Topics consistently getting high engagement
- Questions asked in comments
- Content requests

**Recommended Actions:**
- Create blog content
- Create paid ads
- Include in email narrative
- Product feature validation

**Output:** `social_topic_signal`

#### Job 8C.4: Declining Social Performance
**Frequency:** Daily  
**Lookback:** 7d vs 28d  
**Data Sources:** Social platforms  
**Checks:**
- Impressions declining
- Engagement rate declining
- Click-through rate declining

**Thresholds:**
- Impressions drop > 30% = distribution issue
- Engagement rate drop > 20% = content issue
- Steady decay across posts = algorithm shift

**Output:** `social_distribution_decay`

#### Job 8C.5: Social Proof Amplification Opportunities
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Social platforms  
**Checks:**
- Testimonials
- User-generated content
- Positive replies/comments
- Case study mentions

**Recommended Actions:**
- Feature on landing pages
- Include in ads
- Add to email
- Create testimonial page

**Output:** `social_proof_amplify`

---

### 9) CROSS-CHANNEL OPPORTUNITIES (The Compounding Edge)

#### Job 9.1: SEO Winner Pages Not Supported by Email
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** GA4, DataForSEO, ActiveCampaign, Stripe  
**Logic:**
```sql
-- Find pages:
1. Rising organic conversions
2. Minimal email traffic
3. High revenue potential
```

**Thresholds:**
- Organic sessions > 500/month + email traffic < 5% = gap
- Revenue from organic > $500/month + no email support = opportunity

**Output:** `channel_gap_email_support`

#### Job 9.2: Revenue Pages with No Paid Coverage
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** Stripe, GA4, Google Ads  
**Logic:**
```sql
-- Find pages:
1. Producing high revenue
2. Low/zero paid spend
3. Not brand terms (defensible)
```

**Thresholds:**
- Revenue > $1k/month + paid spend < $100 = opportunity
- High-intent keywords not bid on = gap

**Recommended Actions:**
- Launch retargeting campaign
- Search coverage for high-intent terms
- Competitor conquest (guardrailed)
- Display remarketing

**Output:** `channel_gap_paid_support`

#### Job 9.3: Paid Spending Landing on Weak Pages
**Frequency:** Daily  
**Lookback:** 7d  
**Data Sources:** Google Ads, GA4  
**Logic:**
```sql
-- Find paid landing pages:
1. Low CVR
2. Alternative page exists with higher CVR for same intent/topic
```

**Thresholds:**
- Paid landing CVR < 2% when alternative > 4% = reroute
- $500+ spent on weak landing = HIGH priority

**Recommended Actions:**
- Route paid traffic to better page
- Clone best elements to paid landing
- A/B test page variants
- Create dedicated paid landing page

**Output:** `landing_page_routing_fix`

#### Job 9.4: Email Driving Traffic to Declining SEO Pages
**Frequency:** Daily  
**Lookback:** 30d  
**Data Sources:** ActiveCampaign, DataForSEO, GA4  
**Checks:**
- Email traffic landing on pages with declining rank
- Misalignment of messaging + intent

**Detection:**
- Email promotes page that's losing rank
- Message mismatch (email = discount, page = education)

**Output:** `message_match_alignment`

#### Job 9.5: Content Performing Organically But Not Socially Distributed
**Frequency:** Weekly  
**Lookback:** 30d  

**Output:** `distribution_gap_social`

#### Job 9.6: Social Topics with Engagement But No SEO Content
**Frequency:** Weekly  
**Lookback:** 30d  

**Output:** `seo_content_from_social_signal`

#### Job 9.7: High-Converting Pages Not Supported by Content or Social
**Frequency:** Weekly  
**Lookback:** 30d  

**Output:** `page_support_gap`

#### Job 9.8: Content Driving Email Signups But Not Revenue
**Frequency:** Weekly  
**Lookback:** 30d  

**Output:** `content_to_lifecycle_gap`

---

### 10) LEADING INDICATORS & CAUSAL ANALYSIS

#### Job 10: Causal Signal Learning
**Frequency:** Weekly (not daily - needs more data)  
**Lookback:** 90+ days minimum  
**Data Sources:** All sources  
**Analysis:**
```sql
-- Learn patterns:
1. Rank improvement → conversions (with lag X days)
2. Email CTR decline → churn (with lag Y days)
3. Paid CPA increase → MER decline (with lag)
4. Content topics → LTV correlation
5. Seasonal patterns
6. Channel interaction effects
```

**Detection Methods:**
- Correlation analysis
- Lag analysis (cross-correlation)
- Granger causality tests
- Time series forecasting

**Example Learnings:**
- "Rank improvement typically leads to 12% conv increase after 12 days"
- "Email CTR drop below 2% predicts churn increase in 14 days"
- "Content topic 'pricing comparison' correlates with 2.3x LTV"

**Output:** `leading_indicator`

**Confidence Scoring:**
```
correlation_strength: 0-1 (Pearson r)
sample_size_score: min(1.0, observations / 100)
consistency_score: % of time pattern holds
confidence = (correlation_strength + sample_size_score + consistency_score) / 3
```

---

## 🎯 SCORING & PRIORITIZATION

### Opportunity Score Formula
```python
# For every opportunity:
impact_dollars = estimated_revenue_upside_7d or cost_savings_7d
confidence = calculate_confidence(data_volume, stability, historical_pattern)
effort = 'low' | 'medium' | 'high'  # maps to 1, 2, 3
risk = 'low' | 'medium' | 'high'    # maps to 1, 2, 3

effort_weight = {'low': 1, 'medium': 2, 'high': 3}[effort]
risk_weight = {'low': 1, 'medium': 1.5, 'high': 2}[risk]

score = (impact_dollars * confidence) / (effort_weight * risk_weight)
```

### Priority Ranking
```python
# Sort opportunities:
opportunities.sort(key=lambda opp: opp.score, reverse=True)

# Apply filters:
- Must have confidence >= 0.65 (Operator execution threshold)
- High risk requires approval (even if high score)
- Effort 'high' = queue for planning (not auto-execute)
```

---

## 📋 DAILY RUN ORDER

```
1. Preflight Checks (0:00-0:05)
   ├─ Data freshness & completeness
   ├─ Mapping health check
   └─ Schema validation

2. Build Yesterday Rollups (0:05-0:15)
   ├─ daily_entity_metrics
   ├─ daily_campaign_metrics
   └─ daily_email_metrics (if not already built)

3. Run Detectors in Order (0:15-0:45)
   ├─ Revenue/funnel anomalies (FIRST - most critical)
   ├─ Paid scale + waste + query mining
   ├─ Email scale + leaks + mismatch
   ├─ SEO striking distance + rank drops + expand
   ├─ Pages/content opportunities
   ├─ Cross-channel gaps
   └─ Social (if data available)

4. Score + Rank Opportunities (0:45-0:50)
   ├─ Calculate impact, confidence, effort, risk
   ├─ Compute scores
   └─ Sort by score DESC

5. Write Outputs (0:50-0:55)
   ├─ daily_summary.json
   ├─ opportunities.jsonl
   └─ action_candidates.jsonl (risk=low, approval=false)

6. (Optional) Send Notifications (0:55-1:00)
   ├─ Slack summary
   ├─ Email digest
   └─ Dashboard update

Total Runtime: ~1 hour
```

---

## 📤 OUTPUT FORMATS

### 1. daily_summary.json
```json
{
  "date": "2026-01-25",
  "run_timestamp": "2026-01-25T06:00:00Z",
  "data_health": {
    "ga4": {"status": "ok", "latest_date": "2026-01-24", "row_count": 12450},
    "google_ads": {"status": "ok", "latest_date": "2026-01-24", "row_count": 850},
    "stripe": {"status": "ok", "latest_date": "2026-01-24", "row_count": 15},
    "activecampaign": {"status": "warn", "latest_date": "2026-01-23", "message": "1 day behind"},
    "dataforseo": {"status": "ok", "latest_date": "2026-01-24", "row_count": 1015}
  },
  "total_opportunities": 47,
  "top_wins": [
    "Campaign 'Brand CA' MER 5.2x (50% above baseline)",
    "Page '/pricing' gained 3 positions for high-intent keyword"
  ],
  "top_risks": [
    "Revenue down 24% yesterday vs 7d avg",
    "Email open rate dropped 18% for segment 'trial_users'"
  ],
  "top_opportunities": [
    "opp_2026-01-25_001",
    "opp_2026-01-25_002",
    "opp_2026-01-25_003"
  ],
  "breakdown": {
    "scale_winner": 8,
    "fix_loser": 12,
    "declining_performer": 6,
    "cross_channel": 9,
    "seo_opportunities": 7,
    "email_opportunities": 3,
    "page_opportunities": 2
  }
}
```

### 2. opportunities.jsonl
```jsonl
{"opportunity_id":"opp_2026-01-25_001","created_at":"2026-01-25T06:15:00Z","type":"scale_winner","channel":"paid_search","entity":{"entity_type":"campaign","entity_id":"campaign_brand_ca","platform_id":"123456789"},"evidence":{"window_days":7,"metrics":{"cost":1820.22,"revenue":9430.00,"mer":5.18,"conversions":42},"baseline":{"mer":3.40,"cost_7d_avg":1500},"delta":{"mer_pct":52.4,"revenue_uplift":3200}},"hypothesis":"Campaign outperforming baseline by 52%; stable for 7 days; impression share lost to budget indicates room to scale","recommended_actions":[{"action_type":"increase_budget","target":{"platform":"google_ads","campaign_id":"123456789"},"params":{"pct_increase":20,"new_daily_budget":420,"cap_daily_budget":500},"success_metric":"mer","guardrails":{"min_mer":3.5,"max_cpa":120},"requires_approval":true}],"estimated_uplift":{"revenue_7d":1500,"conversions_7d":10},"confidence":0.82,"effort":"low","risk":"medium","score":987.6,"time_to_impact":"now","rollback_plan":{"action_type":"restore_budget","params":{"revert_to_previous":true}},"priority":"high"}
{"opportunity_id":"opp_2026-01-25_002",...}
```

### 3. action_candidates.jsonl
```jsonl
{"action_id":"act_2026-01-25_001","opportunity_id":"opp_2026-01-25_015","action_type":"pause_campaign","target":{"platform":"google_ads","campaign_id":"987654321"},"reason":"$250 spent, 0 conversions after 150 clicks","confidence":0.91,"risk":"low","requires_approval":false,"auto_execute":true}
```

### 4. learning_memory.json
```json
{
  "last_updated": "2026-01-25",
  "learnings": [
    {
      "pattern_id": "seo_rank_to_conv",
      "signal": "seo_rank_improvement",
      "entity_type": "page",
      "avg_lag_days": 12,
      "downstream_metric": "conversions",
      "correlation_strength": 0.68,
      "confidence": 0.77,
      "sample_size": 145,
      "description": "SEO rank improvements typically lead to 12% conversion increase after 12 days"
    }
  ]
}
```

---

## 🎯 TOTAL COUNTS

**Metrics:** 30+ core metrics  
**Lookback Windows:** 7 distinct patterns  
**Analysis Jobs:** 50+ opportunity detectors  
**Opportunity Types:** 50+ unique types  
**Daily Outputs:** 4 structured files  
**Total Daily Runtime:** ~60 minutes  

**Data Sources Required:**
- GA4 (daily export)
- Google Ads (daily sync)
- DataForSEO (daily/weekly sync)
- Stripe (daily sync)
- ActiveCampaign (daily sync)
- Google Search Console (optional, enhances SEO)

**Tables Required:**
- `events_all` (atomic events) - optional but recommended
- `daily_entity_metrics` (rollups) - REQUIRED
- `daily_campaign_metrics` (rollups) - REQUIRED
- `entity_map` (canonical IDs) - REQUIRED
- `opportunities` (Scout outputs) - REQUIRED
- `actions_log` (Operator outputs) - for Operator phase
- `metric_registry` (metric definitions) - REQUIRED
- `learning_memory` (causal patterns) - optional

---

## 📊 CONFIDENCE SCORING METHODOLOGY

### Base Confidence
```python
def calculate_base_confidence(data_volume):
    """More data = more confidence"""
    return 0.5 + (0.5 * min(1.0, data_volume / 1000))
```

### Stability Boost
```python
if stable_for_days >= 7:
    confidence += 0.2
elif stable_for_days >= 3:
    confidence += 0.1
```

### Multi-Source Confirmation
```python
if multiple_sources_confirm_pattern:
    confidence += 0.1
```

### Historical Pattern Match
```python
if matches_known_pattern_from_learning_memory:
    confidence += 0.15
```

### Final Confidence
```python
confidence = min(1.0, base + stability + multi_source + historical)
```

---

**END OF COMPLETE SPECIFICATION**
