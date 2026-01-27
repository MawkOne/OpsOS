# Scout AI Expansion: 37 New Detectors

**Goal:** Expand from 23 → 60 detectors (27% → 85% coverage)  
**Organized by:** Phase, then Marketing Area  
**Based on:** 2026 industry best practices research

---

## 📊 CURRENT STATE (23 Detectors)

### Email (3)
1. ✅ detect_email_engagement_drop
2. ✅ detect_email_high_opens_low_clicks
3. ✅ detect_email_trends_multitimeframe

### SEO (4)
4. ✅ detect_seo_striking_distance
5. ✅ detect_seo_rank_drops
6. ✅ detect_keyword_cannibalization
7. ✅ detect_seo_rank_trends_multitimeframe

### Advertising (3)
8. ✅ detect_cost_inefficiency
9. ✅ detect_paid_waste
10. ✅ detect_paid_campaigns_multitimeframe

### Pages (5)
11. ✅ detect_scale_winners
12. ✅ detect_fix_losers
13. ✅ detect_high_traffic_low_conversion_pages
14. ✅ detect_page_engagement_decay
15. ✅ detect_scale_winners_multitimeframe

### Content (2)
16. ✅ detect_content_decay
17. ✅ detect_content_decay_multitimeframe

### Traffic (3)
18. ✅ detect_cross_channel_gaps
19. ✅ detect_declining_performers
20. ✅ detect_declining_performers_multitimeframe

### Revenue (3)
21. ✅ detect_revenue_anomaly
22. ✅ detect_metric_anomalies
23. ✅ detect_revenue_trends_multitimeframe

---

## 🚀 PHASE 1: FAST DETECTION LAYER (14 New Detectors)
**Priority:** CRITICAL  
**Timeline:** 2-3 weeks  
**Goal:** Add real-time/daily alerts to catch issues before they become expensive

---

### 📧 EMAIL (2 detectors)

#### 24. detect_email_deliverability_crash
**Layer:** Fast (Daily)  
**What:** Bounce rate >10%, spam complaints spike, or deliverability rate drops >20%  
**Why:** Industry research shows deliverability issues can cost thousands in lost revenue if not caught immediately  
**Data Needed:** Bounce rates, spam complaints, deliverability scores from email platform  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Hard bounce rate > 5% (normal <1%)
- Soft bounce rate > 10% (normal <2%)
- Spam complaint rate > 0.1% (normal <0.01%)
- Deliverability rate drops >20% in 24 hours
```

#### 25. detect_email_volume_gap
**Layer:** Strategic (Monthly)  
**What:** Email send volume <50% of industry benchmark for business size/stage  
**Why:** Underutilization = missed revenue opportunity  
**Data Needed:** Monthly send volume, subscriber count, industry benchmarks  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Sends per month < 2x subscriber count (benchmark: 4-8x)
- No emails sent in 30+ days
- Volume declining 3 months in a row
```

---

### 🔍 SEO (3 detectors)

#### 26. detect_seo_rank_volatility_daily
**Layer:** Fast (Daily)  
**What:** Top 20 keywords dropped >3 positions in 24 hours  
**Why:** Research shows catching rank drops in 18 hours vs. 6 days saves $4,200/month  
**Data Needed:** Daily rank tracking (currently we have weekly)  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Top 10 keyword drops >3 positions in 1 day
- Top 20 keyword drops >5 positions in 1 day
- Any top 3 keyword drops off page 1
- 10+ keywords drop same day (algorithm update)
```

#### 27. detect_seo_indexing_issues
**Layer:** Fast (Daily)  
**What:** Pages deindexed, indexing errors, or crawl rate drops significantly  
**Why:** If Google can't crawl/index, you're invisible  
**Data Needed:** Google Search Console API - indexed pages, crawl errors  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Indexed pages drop >10% in 7 days
- Critical pages deindexed
- Crawl errors spike >50%
- Coverage issues increase
```

#### 28. detect_seo_serp_feature_loss
**Layer:** Fast (Weekly)  
**What:** Lost featured snippet, AI Overview, or other SERP feature  
**Why:** SERP features drive 2-3x more traffic than standard results  
**Data Needed:** SERP feature tracking from rank tracker  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Lost featured snippet held for 30+ days
- Dropped out of AI Overview
- Lost "People Also Ask" placement
- Lost local pack placement
```

---

### 💰 ADVERTISING (4 detectors)

#### 29. detect_ad_budget_burn_realtime
**Layer:** Fast (Hourly)  
**What:** Spending >2x target rate or will exhaust daily budget in <8 hours  
**Why:** Prevent overnight budget burns that waste thousands  
**Data Needed:** Real-time ad spend, daily budget, time of day  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Spending >$X/hour when target is $Y/day
- On track to spend 200%+ of daily budget
- Single campaign burning >50% of total budget
- CPA spiking while spend accelerates
```

#### 30. detect_ad_creative_fatigue
**Layer:** Trend (Weekly)  
**What:** CTR declining >30% over 2 weeks despite consistent impressions  
**Why:** Fatigued creatives waste budget, need refresh  
**Data Needed:** CTR trends per ad/ad set, impression frequency  
**Priority:** 🔴 HIGH

```python
# Alert if:
- CTR dropped >30% from first 7 days to last 7 days
- Impressions stable but engagement declining
- Frequency >5 (audience saturation)
- CPM increasing while CTR decreasing
```

#### 31. detect_ad_audience_saturation
**Layer:** Trend (Weekly)  
**What:** Frequency >5, CTR declining, CPM rising = audience exhausted  
**Why:** Diminishing returns, need audience expansion  
**Data Needed:** Frequency, CTR trends, CPM trends, reach percentage  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Average frequency >5
- Reached >80% of target audience
- CTR dropped >40% since launch
- CPM increased >50% since launch
```

#### 32. detect_ad_quality_score_drops
**Layer:** Fast (Daily)  
**What:** Quality Score drops below 5/10 or drops 2+ points  
**Why:** Low QS = higher CPCs, worse ad placement  
**Data Needed:** Quality Score per keyword/ad (Google Ads API)  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Any keyword drops to QS <5
- QS drops 2+ points in 7 days
- >20% of keywords at QS <7
- Landing page experience rated "Below average"
```

---

### 📄 PAGES/CRO (3 detectors)

#### 33. detect_form_abandonment_spike
**Layer:** Fast (Daily)  
**What:** Form/cart abandonment rate >20% above baseline  
**Why:** Forms are conversion bottlenecks, spikes indicate UX issues  
**Data Needed:** Form start events, form submit events, cart adds vs. checkouts  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Form abandonment rate >60% (normal ~40%)
- Cart abandonment rate >80% (normal ~70%)
- Abandonment spiked >20% from 7-day avg
- Specific form field has >50% drop-off
```

#### 34. detect_mobile_desktop_cvr_gap
**Layer:** Trend (Weekly)  
**What:** Mobile CVR <50% of desktop CVR (should be 70-80%)  
**Why:** Mobile optimization gap = lost conversions  
**Data Needed:** CVR by device type  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Mobile CVR <50% of desktop CVR
- Mobile traffic >50% but conversions <30%
- Gap widening over time
- Mobile bounce rate >65%
```

#### 35. detect_page_error_spike
**Layer:** Fast (Hourly)  
**What:** 404s, 500s, or JavaScript errors spiking on key pages  
**Why:** Broken pages = lost revenue  
**Data Needed:** Error tracking (Sentry, etc.) or GA4 error events  
**Priority:** 🔴 HIGH

```python
# Alert if:
- 404 rate >5% on tracked pages
- JavaScript errors on checkout/form pages
- Page load failures >2%
- Errors increased >10x from baseline
```

---

### 🚦 TRAFFIC (2 detectors)

#### 36. detect_traffic_source_disappearance
**Layer:** Fast (Daily)  
**What:** Major traffic source dropped >50% or disappeared entirely  
**Why:** Early warning of channel issues (deindexing, ad disapproval, etc.)  
**Data Needed:** Daily traffic by source/medium  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Any source providing >10% traffic drops >50% in 1 day
- Organic traffic drops >30% in 1 day (indexing issue)
- Paid traffic stops (disapproval, budget exhaustion)
- Referral source drops to zero
```

#### 37. detect_channel_dependency_risk
**Layer:** Strategic (Monthly)  
**What:** >60% of traffic/revenue from single channel = high risk  
**Why:** Channel dependency = business risk if that channel fails  
**Data Needed:** Monthly traffic/revenue by channel  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Single channel >60% of traffic
- Single channel >70% of revenue
- No diversification progress over 90 days
- Top channel declining with no backup growing
```

---

---

## 🎯 PHASE 2: GAP DETECTION LAYER (14 New Detectors)
**Priority:** MEDIUM  
**Timeline:** 4-6 weeks  
**Goal:** Identify what's NOT being done vs. best practices

---

### 📧 EMAIL (2 detectors)

#### 38. detect_email_list_health_issues
**Layer:** Trend (Weekly)  
**What:** List growth stagnant, unsubscribe rate high, engagement declining  
**Why:** List health = email program health  
**Data Needed:** Subscriber growth, unsubscribe rate, inactive subscribers  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- List growth <2% per month (benchmark: 5-10%)
- Unsubscribe rate >0.5% (normal <0.2%)
- >40% of list inactive (no opens in 90 days)
- More unsubscribes than new subscribers 3 months running
```

#### 39. detect_email_revenue_attribution_gap
**Layer:** Strategic (Monthly)  
**What:** Email driving traffic but not tracking revenue properly  
**Why:** Can't optimize what you don't measure  
**Data Needed:** Email clicks, revenue with email touchpoint, UTM tracking  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Email clicks exist but zero attributed revenue
- Revenue attribution <1% of clicks
- Missing UTM parameters on email links
- No conversion tracking set up
```

---

### 🔍 SEO (2 detectors)

#### 40. detect_seo_serp_feature_opportunities
**Layer:** Strategic (Monthly)  
**What:** Ranking 1-10 for queries with featured snippets but we don't have snippet  
**Why:** Featured snippet = 2-3x more traffic  
**Data Needed:** Rankings + SERP feature presence  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Ranking 1-10 but competitor has featured snippet
- Ranking for question keywords without "People Also Ask"
- No video results for visual query keywords
- Missing local pack for local intent keywords
```

#### 41. detect_seo_technical_health_score
**Layer:** Trend (Weekly)  
**What:** Aggregate score of Core Web Vitals, mobile-friendliness, HTTPS, structured data  
**Why:** Technical SEO foundation impacts all rankings  
**Data Needed:** PageSpeed Insights API, Search Console  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Core Web Vitals failing on >20% of pages
- Mobile usability issues increasing
- Missing structured data on key page types
- HTTPS issues detected
- Aggregate score drops >10 points
```

---

### 💰 ADVERTISING (3 detectors)

#### 42. detect_ad_retargeting_gap
**Layer:** Strategic (Monthly)  
**What:** Website visitors not being retargeted or retargeting spend <10% of total  
**Why:** Retargeting typically has 2-3x better ROI  
**Data Needed:** Retargeting campaign spend vs. total, pixel firing, audience sizes  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- No retargeting campaigns active
- Retargeting spend <10% of total (benchmark: 20-30%)
- Retargeting audience <100 people
- Pixel not firing on key pages
```

#### 43. detect_ad_device_geo_optimization_gaps
**Layer:** Strategic (Monthly)  
**What:** Major performance differences by device/geo but no optimization  
**Why:** Easy wins through bid adjustments  
**Data Needed:** Performance by device, location, time of day  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Mobile CPA 2x higher than desktop, no mobile bid adjustment
- Specific geo has 3x better ROAS, no geo bid increase
- Time of day has 50%+ CVR variance, no dayparting
```

#### 44. detect_ad_competitor_activity_surge
**Layer:** Trend (Weekly)  
**What:** Impression share lost to competitors increased >20%  
**Why:** Competitor aggression may require response  
**Data Needed:** Auction insights from Google Ads  
**Priority:** 🟢 LOW

```python
# Alert if:
- Impression share lost to competitors >30%
- Specific competitor increased impression share >20%
- Average position dropped while budget stable (outbid)
```

---

### 📄 PAGES/CRO (3 detectors)

#### 45. detect_page_speed_impact_on_cvr
**Layer:** Strategic (Monthly)  
**What:** Slow pages (<50 PageSpeed score) with high traffic and low CVR  
**Why:** 1-second delay = 7% CVR loss  
**Data Needed:** PageSpeed scores + CVR by page  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Page Speed <50 on pages with >1000 visitors/month
- LCP >2.5s correlated with <1% CVR
- Pages with speed issues getting >20% of traffic
```

#### 46. detect_ab_test_opportunities
**Layer:** Strategic (Monthly)  
**What:** High-traffic pages with moderate CVR that could benefit from testing  
**Why:** A/B testing 2-5% CVR improvements on high-traffic pages = big wins  
**Data Needed:** Traffic, CVR, page types  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Page has 1000+ visitors/month, CVR 1-5% (testable range)
- Page unchanged for 90+ days
- Similar pages have 2x+ better CVR (learn from winners)
```

#### 47. detect_multitouch_conversion_path_issues
**Layer:** Strategic (Monthly)  
**What:** Long conversion paths with >50% drop-off at specific steps  
**Why:** Identify and fix funnel leaks  
**Data Needed:** GA4 path exploration, funnel reports  
**Priority:** 🟢 LOW

```python
# Alert if:
- Conversion path >5 steps
- >50% drop-off at specific step
- Average path to conversion >7 days (too long)
```

---

### ✍️ CONTENT (4 detectors)

#### 48. detect_content_publishing_volume_gap
**Layer:** Strategic (Monthly)  
**What:** Publishing <4 posts/month when competitors publish 15+  
**Why:** Volume matters for SEO authority and audience building  
**Data Needed:** New content published per month, industry benchmarks  
**Priority:** 🔴 HIGH

```python
# Alert if:
- Publishing <4 posts/month (benchmark: 8-16 for growth stage)
- Zero new content in 30+ days
- Publishing velocity declining 3 months in a row
- Competitors publishing 3x+ more
```

#### 49. detect_content_to_lead_attribution
**Layer:** Strategic (Monthly)  
**What:** Content driving traffic but not generating leads/conversions  
**Why:** Content should generate leads, not just pageviews  
**Data Needed:** Content pageviews + lead form submissions with content touchpoint  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Blog getting >5000 visitors/month but <10 leads
- Content-to-lead rate <1% (benchmark: 2-5%)
- Zero CTAs or forms on content pages
```

#### 50. detect_content_topic_format_winners
**Layer:** Strategic (Monthly)  
**What:** Identify which topics/formats (how-to, listicle, video, etc.) perform 3x+ better  
**Why:** Double down on what works  
**Data Needed:** Content categorized by topic and format, engagement metrics  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Specific topic has 3x+ better engagement
- Specific format has 5x+ better CVR
- Video content outperforming text 10x but only 5% of content is video
```

#### 51. detect_content_freshness_decay
**Layer:** Trend (Monthly)  
**What:** High-performing content not updated in 12+ months while competitors refresh  
**Why:** Fresh content ranks better, especially for time-sensitive topics  
**Data Needed:** Content last updated date, traffic trends  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Top 10 posts not updated in 12+ months
- Traffic declining on aged content while topic still relevant
- Competitor content published more recently ranking higher
```

---

### 🚦 TRAFFIC (2 detectors)

#### 52. detect_traffic_quality_by_source
**Layer:** Trend (Weekly)  
**What:** Traffic sources with high bounce rate (>70%) or low time on site (<30s)  
**Why:** Low-quality traffic wastes money if from paid sources  
**Data Needed:** Bounce rate, time on site, pages per session by source  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Paid source has >70% bounce rate (wasting money)
- Source has <30s avg. session duration
- Source has 0% conversion rate despite high traffic
- Bot/spam traffic identified (impossible geography + bounce)
```

#### 53. detect_cac_by_channel
**Layer:** Strategic (Monthly)  
**What:** Customer acquisition cost varies 5x+ by channel but no reallocation  
**Why:** Should shift budget from expensive to efficient channels  
**Data Needed:** Cost by channel, conversions by channel  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- CAC varies >5x by channel
- Spending most on highest-CAC channel
- Lowest CAC channel not being scaled
```

---

### 💵 REVENUE (3 detectors)

#### 54. detect_revenue_by_channel_attribution
**Layer:** Strategic (Monthly)  
**What:** Revenue attribution by first-touch, last-touch, and multi-touch models  
**Why:** Understand true channel value  
**Data Needed:** Revenue with full conversion path data  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Attribution models show >50% difference in channel value
- Channel getting all last-touch credit but zero first-touch
- Multi-touch reveals undervalued assist channels
```

#### 55. detect_mrr_arr_tracking
**Layer:** Strategic (Monthly)  
**What:** For SaaS businesses, track MRR/ARR trends, churn, expansion revenue  
**Why:** Core SaaS metrics  
**Data Needed:** Subscription data (Stripe, etc.)  
**Priority:** 🟡 MEDIUM

```python
# Alert if (SaaS businesses):
- MRR declining 2 months in a row
- Churn rate >5% (SaaS benchmark: 3-5%)
- Negative net revenue retention
- No expansion revenue (upsells/cross-sells)
```

#### 56. detect_transaction_refund_anomalies
**Layer:** Fast (Daily)  
**What:** Transaction volume or refund rate deviating significantly from baseline  
**Why:** Early fraud detection or product quality issues  
**Data Needed:** Transaction count, refund count and reasons  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Transaction volume drops >30% in 1 day (payment processor issue?)
- Refund rate >10% (normal <5%)
- Refunds spike for specific product/service
- Same-day refunds >20% (fraud indicator)
```

---

## 🔮 PHASE 3: PREDICTIVE LAYER (9 New Detectors)
**Priority:** LOW  
**Timeline:** 8-12 weeks  
**Goal:** Predict issues before they happen, automate recommendations

---

### ALL AREAS (Cross-Functional Detectors)

#### 57. detect_revenue_forecast_deviation
**Layer:** Predictive (Daily)  
**What:** Current revenue tracking >15% below/above forecast  
**Why:** Early warning to adjust strategy or resources  
**Data Needed:** ML forecast model (Prophet, etc.) + actual revenue  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Current revenue 15%+ below forecast
- Trending toward missing monthly target by >10%
- Forecast confidence interval widening (uncertainty)
- Seasonality pattern breaking down
```

#### 58. detect_churn_prediction_early_warning
**Layer:** Predictive (Weekly)  
**What:** Customers showing early signs of churn (declining usage, support tickets, etc.)  
**Why:** Prevent churn before it happens  
**Data Needed:** Product usage data, support tickets, NPS, payment issues  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- Customer usage declined 50%+ over 30 days
- No login in 14+ days (was daily user)
- Multiple failed payments
- Low NPS score + declining engagement
- Churn risk score >70%
```

#### 59. detect_multitouch_attribution_model
**Layer:** Strategic (Monthly)  
**What:** Build multi-touch attribution to show true channel value  
**Why:** Optimize based on full customer journey, not just last click  
**Data Needed:** Full conversion path data from GA4  
**Priority:** 🟡 MEDIUM

```python
# What it reveals:
- Channels undervalued in last-click (organic, social)
- Assist value of awareness channels
- Optimal channel mix for acquisition
- True CAC by channel including assists
```

#### 60. detect_ab_test_recommendations
**Layer:** Strategic (Monthly)  
**What:** Automatically suggest A/B tests based on data patterns  
**Why:** Proactive optimization without manual analysis  
**Data Needed:** Page performance, industry benchmarks, test history  
**Priority:** 🟢 LOW

```python
# Recommendations like:
- "Test different CTA on Product Page A (similar pages CVR 2x higher)"
- "Test shorter form on Demo page (50% abandonment at field 5)"
- "Test value prop on Homepage (bounce rate 20% above industry avg)"
```

#### 61. detect_seasonality_adjusted_alerts
**Layer:** Predictive (Daily)  
**What:** Adjust anomaly detection for known seasonal patterns  
**Why:** Reduce false positives, detect real issues  
**Data Needed:** 12+ months history for seasonality modeling  
**Priority:** 🟢 LOW

```python
# Intelligence:
- Don't alert on expected Black Friday traffic spike
- DO alert if Black Friday spike 30% below last year
- Adjust baselines for day-of-week patterns
- Account for holiday seasonality
```

#### 62. detect_automated_optimization_suggestions
**Layer:** Strategic (Monthly)  
**What:** AI-generated optimization recommendations across all areas  
**Why:** Scale human expertise  
**Data Needed:** All performance data + industry benchmarks  
**Priority:** 🟢 LOW

```python
# Suggestions like:
- "Increase bid 20% on Campaign X (ROAS 8:1, limited by budget)"
- "Pause Campaign Y (ROAS 0.5:1, bleeding money)"
- "Refresh content on Page Z (traffic down 60%, competitors updated)"
- "Add retargeting campaign (500 daily visitors, 0% retargeting)"
```

#### 63. detect_cohort_performance_trends
**Layer:** Strategic (Monthly)  
**What:** Track cohorts (acquisition month) to see which periods produced best customers  
**Why:** Optimize acquisition channels and timing  
**Data Needed:** Customer acquisition date + LTV  
**Priority:** 🟢 LOW

```python
# Insights:
- Q4 customers have 2x LTV of Q2 customers
- Organic customers churn 50% less than paid
- Customers acquired via content have higher expansion revenue
```

#### 64. detect_unit_economics_dashboard
**Layer:** Strategic (Monthly)  
**What:** Track CAC, LTV, LTV:CAC ratio, payback period by channel  
**Why:** Fundamental business health metrics  
**Data Needed:** Acquisition cost + customer lifetime value  
**Priority:** 🟡 MEDIUM

```python
# Alert if:
- LTV:CAC ratio <3:1 (unhealthy unit economics)
- CAC payback period >12 months
- Gross margin by channel <50%
- Any channel with LTV < CAC (losing money)
```

#### 65. detect_growth_velocity_trends
**Layer:** Predictive (Weekly)  
**What:** Is growth accelerating or decelerating? Predict inflection points  
**Why:** Strategic planning and resource allocation  
**Data Needed:** Revenue, users, MRR growth rates over time  
**Priority:** 🟢 LOW

```python
# Insights:
- Growth rate declining 3 months in a row (deceleration)
- Growth rate increasing (acceleration)
- Predict when you'll hit next milestone ($1M MRR, 10K customers)
- Identify inflection points in growth curve
```

---

## 📊 SUMMARY: 37 New Detectors

### By Phase
- **Phase 1 (Fast Detection):** 14 detectors
- **Phase 2 (Gap Detection):** 14 detectors
- **Phase 3 (Predictive):** 9 detectors
- **TOTAL NEW:** 37 detectors

### By Priority
- 🔴 **HIGH:** 17 detectors
- 🟡 **MEDIUM:** 14 detectors
- 🟢 **LOW:** 6 detectors

### By Area
- **Email:** 4 new (3→7 total)
- **SEO:** 5 new (4→9 total)
- **Advertising:** 7 new (3→10 total)
- **Pages/CRO:** 6 new (5→11 total)
- **Content:** 4 new (2→6 total)
- **Traffic:** 4 new (3→7 total)
- **Revenue:** 5 new (3→8 total)
- **Cross-Functional:** 2 new (0→2 total)

### Final Coverage: 60 detectors = ~85% of best practices

---

## 🎯 RECOMMENDED BUILD ORDER

### Week 1-2: CRITICAL ALERTS (Highest ROI)
1. detect_ad_budget_burn_realtime (#29) - Prevent overnight burns
2. detect_traffic_source_disappearance (#36) - Catch channel failures
3. detect_email_deliverability_crash (#24) - Prevent list damage
4. detect_seo_rank_volatility_daily (#26) - Catch drops fast

### Week 3-4: HEALTH MONITORING
5. detect_seo_indexing_issues (#27)
6. detect_form_abandonment_spike (#33)
7. detect_page_error_spike (#35)
8. detect_channel_dependency_risk (#37)

### Week 5-6: OPTIMIZATION OPPORTUNITIES
9. detect_ad_creative_fatigue (#30)
10. detect_ad_audience_saturation (#31)
11. detect_mobile_desktop_cvr_gap (#34)
12. detect_content_publishing_volume_gap (#48)

### Week 7-8: GAP DETECTION
13. detect_email_volume_gap (#25)
14. detect_ad_retargeting_gap (#42)
15. detect_content_to_lead_attribution (#49)

### Continue with remaining Medium/Low priority detectors...

---

## 💾 DATA REQUIREMENTS

### Need to Add:
- **Email platform APIs:** Bounce rates, spam complaints, deliverability scores
- **Real-time ad spend:** Hourly spend data from ad platforms
- **Form analytics:** Form field tracking, abandonment points
- **Error tracking:** JavaScript errors, page failures
- **Attribution data:** Full conversion path tracking
- **Competitive data:** SERP tracking, auction insights

### Already Have:
- Daily entity metrics (sessions, conversions, revenue)
- Monthly aggregates and trends
- Entity mapping and filtering
- BigQuery infrastructure for large-scale queries

---

**Next Step:** Start with Phase 1 Week 1-2 (4 CRITICAL detectors) to prove value quickly, then continue systematic expansion.
