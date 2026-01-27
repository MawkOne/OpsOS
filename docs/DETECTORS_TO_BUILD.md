# Detectors To Build - Complete List
**Based on:** Industry Best Practices (2026) vs Current Implementation  
**Current Coverage:** 27% (55 of ~140 total needed)  
**Target Coverage:** 85% (120 detectors)  
**Detectors Needed:** ~65 additional

---

## 📧 EMAIL MARKETING (Need 7 more → Total: 13)

### Currently Have (6):
✅ detect_email_engagement_drop  
✅ detect_email_high_opens_low_clicks  
✅ detect_email_trends_multitimeframe  
✅ detect_email_volume_gap *(expansion)*  
✅ detect_email_revenue_attribution_gap *(expansion)*  
✅ detect_email_deliverability_crash_proxy *(expansion - partial)*

### Need to Build:

#### 🔴 HIGH PRIORITY (4 detectors):
1. **detect_email_bounce_rate_spike**
   - Layer: Fast (daily)
   - Detects: Hard/soft bounce rates >10% (deliverability crisis)
   - Data: ActiveCampaign bounces
   - Threshold: >10% = HIGH, >5% = MEDIUM
   - Action: Check sender reputation, authentication, list quality

2. **detect_email_spam_complaint_spike**
   - Layer: Fast (daily)
   - Detects: Spam complaints increasing >2x baseline
   - Data: ActiveCampaign spam complaints
   - Threshold: >0.1% = HIGH, >0.05% = MEDIUM
   - Action: Review content, segment better, check acquisition sources

3. **detect_email_list_health_decline**
   - Layer: Trend (weekly)
   - Detects: List growth rate declining, unsubscribe rate increasing
   - Data: ActiveCampaign contacts growth/churn
   - Threshold: Growth <2%/month = flag, unsubscribe >0.5% = flag
   - Action: Improve acquisition, reduce frequency, segment better

4. **detect_email_revenue_per_subscriber_decline**
   - Layer: Strategic (monthly)
   - Detects: Revenue per subscriber trending down vs. historical
   - Data: ActiveCampaign sends × Stripe revenue attribution
   - Threshold: >20% decline vs. 3mo avg = flag
   - Action: Improve offers, segment by value, test urgency

#### 🟡 MEDIUM PRIORITY (2 detectors):
5. **detect_email_click_to_open_rate_decline**
   - Layer: Trend (weekly)
   - Detects: Opens stable but clicks declining (engagement issue)
   - Data: ActiveCampaign CTR / open rate
   - Threshold: Click-to-open <15% when open rate >25% = flag
   - Action: Improve CTA placement, reduce link count, clarify value prop

6. **detect_email_optimal_frequency_deviation**
   - Layer: Strategic (monthly)
   - Detects: Send frequency too high/low vs. benchmark
   - Data: ActiveCampaign sends per subscriber per week
   - Threshold: <2/week or >7/week for most lists = flag
   - Action: Test frequency changes, segment by engagement

#### 🟢 LOW PRIORITY (1 detector):
7. **detect_email_device_client_performance_gap**
   - Layer: Strategic (monthly)
   - Detects: Conversion gaps by email client (Gmail vs Outlook) or device
   - Data: ActiveCampaign client data × GA4 conversions
   - Threshold: >30% CVR difference between top clients = optimize
   - Action: Test rendering, optimize for top clients

---

## 🔍 SEO & ORGANIC SEARCH (Need 8 more → Total: 17)

### Currently Have (9):
✅ detect_keyword_cannibalization  
✅ detect_seo_striking_distance  
✅ detect_seo_rank_drops  
✅ detect_seo_rank_trends_multitimeframe  
✅ detect_seo_rank_volatility_daily *(expansion)*  
✅ detect_content_decay  
✅ detect_content_decay_multitimeframe  
✅ detect_content_freshness_decay *(expansion)*  
✅ detect_seo_technical_health_score *(expansion - partial)*

### Need to Build:

#### 🔴 HIGH PRIORITY (4 detectors):
8. **detect_seo_indexing_issues**
   - Layer: Fast (daily)
   - Detects: Pages dropping from index, crawl errors increasing
   - Data: Google Search Console indexing status
   - Threshold: >5% of pages deindexed = HIGH, new errors = flag
   - Action: Check robots.txt, sitemaps, canonical issues, server errors

9. **detect_seo_page_speed_conversion_impact**
   - Layer: Fast (daily)
   - Detects: Core Web Vitals failures hurting conversion rates
   - Data: PageSpeed Insights × GA4 conversion rates
   - Threshold: LCP >2.5s with CVR <50% of fast pages = flag
   - Action: Optimize images, defer JS, improve TTFB

10. **detect_seo_serp_feature_opportunity**
    - Layer: Strategic (weekly)
    - Detects: Keywords where competitors have featured snippets, we don't
    - Data: DataForSEO SERP features
    - Threshold: Top 3 rank without snippet + competitor has one = opportunity
    - Action: Add FAQ schema, create list/table content, optimize formatting

11. **detect_seo_backlink_loss_spike**
    - Layer: Fast (daily)
    - Detects: Sudden backlink losses (site down, removed content)
    - Data: DataForSEO backlinks
    - Threshold: >20 high-DR backlinks lost in 7d = investigate
    - Action: Check referring domains, recover broken links, reach out

#### 🟡 MEDIUM PRIORITY (3 detectors):
12. **detect_seo_mobile_desktop_rank_divergence**
    - Layer: Trend (weekly)
    - Detects: Mobile rankings declining while desktop stable (or vice versa)
    - Data: DataForSEO mobile vs desktop rankings
    - Threshold: >5 position difference on money terms = optimize
    - Action: Check mobile experience, speed, usability

13. **detect_seo_ai_overview_displacement**
    - Layer: Strategic (monthly)
    - Detects: Traffic decline due to AI Overviews (Gemini, ChatGPT) capturing clicks
    - Data: DataForSEO SERP features + GA4 CTR decline
    - Threshold: CTR decline >20% with AI Overview present = adapt
    - Action: Target bottom-of-funnel terms, focus on comparison content

14. **detect_seo_geographic_rank_variance**
    - Layer: Strategic (monthly)
    - Detects: Performance gaps across regions (rank well in US, poor in UK)
    - Data: DataForSEO geographic data
    - Threshold: >10 position difference between top regions = localize
    - Action: Create localized content, build regional backlinks

#### 🟢 LOW PRIORITY (1 detector):
15. **detect_seo_seasonal_opportunity_prep**
    - Layer: Strategic (quarterly)
    - Detects: Upcoming seasonal terms where we're unprepared
    - Data: Historical DataForSEO search volume × current rank
    - Threshold: High-volume season in 30-60d, rank >20 = build now
    - Action: Create seasonal content, build links, optimize pages

---

## 💰 PAID ADVERTISING (Need 10 more → Total: 19)

### Currently Have (9):
✅ detect_cost_inefficiency  
✅ detect_paid_waste  
✅ detect_paid_campaigns_multitimeframe  
✅ detect_ad_retargeting_gap *(expansion)*  
✅ detect_ad_creative_fatigue *(expansion)*  
✅ detect_ad_device_geo_optimization_gaps *(expansion)*  
✅ detect_ad_audience_saturation_proxy *(expansion)*  
✅ detect_cac_by_channel *(expansion)*  
✅ detect_traffic_quality_by_source *(expansion)*

### Need to Build:

#### 🔴 HIGH PRIORITY (5 detectors):
16. **detect_ad_budget_burn_realtime**
    - Layer: Fast (hourly/real-time)
    - Detects: Budget burning faster than expected without conversions
    - Data: Google Ads spend + conversions (real-time API)
    - Threshold: Spend >20% of daily budget before 10am with 0 conv = alert
    - Action: Pause campaigns, adjust bids, check targeting

17. **detect_ad_quality_score_decline**
    - Layer: Fast (daily)
    - Detects: Quality Score drops (increases CPC)
    - Data: Google Ads Quality Score metrics
    - Threshold: QS drops >1 point = flag, QS <5 = HIGH priority
    - Action: Improve ad relevance, landing page experience, expected CTR

18. **detect_ad_policy_disapprovals**
    - Layer: Fast (real-time)
    - Detects: Ads disapproved or limited serving
    - Data: Google Ads approval status
    - Threshold: Any disapproval = immediate alert
    - Action: Review policy violation, fix ad copy/landing page, appeal if needed

19. **detect_ad_impression_share_loss**
    - Layer: Fast (daily)
    - Detects: Impression share declining (losing visibility)
    - Data: Google Ads impression share metrics
    - Threshold: IS lost to budget >30% = increase budget, IS lost to rank >20% = bid up
    - Action: Adjust budgets, improve quality score, increase bids strategically

20. **detect_ad_search_term_waste**
    - Layer: Trend (weekly)
    - Detects: Search queries spending money with no conversions
    - Data: Google Ads search terms report
    - Threshold: >$50 spend, 0 conversions, >100 clicks = add negative
    - Action: Add negative keywords, tighten match types, review intent

#### 🟡 MEDIUM PRIORITY (4 detectors):
21. **detect_ad_bid_strategy_underperformance**
    - Layer: Trend (weekly)
    - Detects: Automated bid strategies (Target CPA, Max Conv) underperforming
    - Data: Google Ads campaign performance by bid strategy
    - Threshold: Actual CPA >30% above target = switch strategy
    - Action: Switch to manual bidding, adjust targets, increase learning data

22. **detect_ad_landing_page_experience_score**
    - Layer: Strategic (monthly)
    - Detects: Low landing page experience scores hurting Quality Score
    - Data: Google Ads LP experience + PageSpeed
    - Threshold: LP experience <Average = flag
    - Action: Improve speed, mobile experience, relevance, clear CTA

23. **detect_ad_audience_expansion_opportunity**
    - Layer: Strategic (monthly)
    - Detects: Similar audiences to winners not being targeted
    - Data: Google Ads audience performance + available audiences
    - Threshold: Winner audience at <50% reach, similar audiences exist = expand
    - Action: Create similar audiences, expand lookalikes, test broad match

24. **detect_ad_scheduling_optimization**
    - Layer: Strategic (monthly)
    - Detects: Performance variance by hour/day (overspending in low-conversion times)
    - Data: Google Ads hour-of-day + day-of-week performance
    - Threshold: >30% CPA difference between best/worst dayparts = adjust
    - Action: Implement ad scheduling, bid adjustments by time

#### 🟢 LOW PRIORITY (1 detector):
25. **detect_ad_competitor_activity_surge**
    - Layer: Trend (weekly)
    - Detects: Competitor ad volume/aggression increasing (CPC rises, IS drops)
    - Data: Google Ads auction insights
    - Threshold: Competitor overlap rate increases >20% or top-of-page rate rises
    - Action: Increase bids defensively, improve ad relevance, expand keywords

---

## 📄 LANDING PAGES & CONVERSION (Need 8 more → Total: 17)

### Currently Have (9):
✅ detect_high_traffic_low_conversion_pages  
✅ detect_page_engagement_decay  
✅ detect_scale_winners_multitimeframe  
✅ detect_scale_winners  
✅ detect_fix_losers  
✅ detect_declining_performers  
✅ detect_declining_performers_multitimeframe  
✅ detect_mobile_desktop_cvr_gap *(expansion)*  
✅ detect_ab_test_opportunities *(expansion)*

### Need to Build:

#### 🔴 HIGH PRIORITY (4 detectors):
26. **detect_form_abandonment_spike**
    - Layer: Fast (daily)
    - Detects: Form abandonment rate increasing >20% vs baseline
    - Data: GA4 form_start vs form_submit events
    - Threshold: Abandonment >60% with >50 starts = investigate
    - Action: Simplify form, fix errors, reduce fields, improve UX

27. **detect_cart_abandonment_increase**
    - Layer: Fast (daily)
    - Detects: Shopping cart abandonment trending up
    - Data: GA4 add_to_cart vs purchase events
    - Threshold: Abandonment >70% or +15% vs last week = flag
    - Action: Check checkout flow, test urgency, add exit-intent offers

28. **detect_page_error_rate_spike**
    - Layer: Fast (real-time/hourly)
    - Detects: 404s, 500s, JS errors on key pages
    - Data: GA4 exception events + server logs
    - Threshold: >1% error rate on conversion pages = critical
    - Action: Fix errors immediately, check deployment issues

29. **detect_page_load_speed_conversion_impact**
    - Layer: Trend (daily)
    - Detects: Slow pages converting worse than fast pages
    - Data: GA4 page speed metrics × conversion rate
    - Threshold: >2s load time with CVR <50% of fast pages = optimize
    - Action: Optimize images, lazy load, CDN, code splitting

#### 🟡 MEDIUM PRIORITY (3 detectors):
30. **detect_micro_conversion_drop**
    - Layer: Trend (weekly)
    - Detects: Leading indicators declining before conversions drop
    - Data: GA4 scroll depth, video views, button clicks
    - Threshold: Micro-conversions down >20% = early warning
    - Action: Investigate user behavior changes, test new CTAs

31. **detect_exit_rate_increase_high_value_pages**
    - Layer: Trend (weekly)
    - Detects: Users leaving key pages at higher rates
    - Data: GA4 exit rate by page
    - Threshold: Exit rate increase >15% on money pages = investigate
    - Action: Check page content, add engagement hooks, improve CTAs

32. **detect_browser_device_compatibility_issues**
    - Layer: Fast (daily)
    - Detects: Specific browsers/devices converting poorly
    - Data: GA4 browser/device × conversion rate
    - Threshold: CVR <50% of average for >10% of traffic = fix
    - Action: Test on affected browsers, fix rendering issues

#### 🟢 LOW PRIORITY (1 detector):
33. **detect_above_fold_conversion_impact**
    - Layer: Strategic (monthly)
    - Detects: Pages with poor above-fold content converting worse
    - Data: GA4 scroll events × conversion rates
    - Threshold: Users not scrolling converting <1% = improve hero
    - Action: Optimize hero section, clearer value prop, stronger CTA

---

## ✍️ CONTENT MARKETING (Need 9 more → Total: 13)

### Currently Have (4):
✅ detect_content_decay  
✅ detect_content_decay_multitimeframe  
✅ detect_content_publishing_volume_gap *(expansion)*  
✅ detect_content_to_lead_attribution *(expansion)*

### Need to Build:

#### 🔴 HIGH PRIORITY (4 detectors):
34. **detect_content_publishing_velocity_below_benchmark**
    - Layer: Strategic (monthly)
    - Detects: Publishing too infrequently vs. competitors/goals
    - Data: Blog post count by month vs. benchmark
    - Threshold: <4 posts/month when target is 8+ = behind
    - Action: Increase content production, repurpose existing, hire writers

35. **detect_content_topic_gap_opportunities**
    - Layer: Strategic (monthly)
    - Detects: High-volume topics competitors rank for, we don't
    - Data: DataForSEO competitor analysis + keyword gaps
    - Threshold: Competitor ranks top 5, we have no content = opportunity
    - Action: Create new content, optimize existing, build topic cluster

36. **detect_content_internal_link_weakness**
    - Layer: Trend (weekly)
    - Detects: High-performing content not linked from other pages
    - Data: GA4 internal navigation clicks + page performance
    - Threshold: Top content with <5 internal links = add more
    - Action: Add contextual links, create content hubs, improve navigation

37. **detect_content_engagement_depth_decline**
    - Layer: Trend (weekly)
    - Detects: Scroll depth, time on page declining (content less engaging)
    - Data: GA4 scroll_depth, avg_engagement_time
    - Threshold: Time on page <60s down from >90s = refresh needed
    - Action: Improve readability, add media, break up walls of text

#### 🟡 MEDIUM PRIORITY (4 detectors):
38. **detect_content_format_winner_identification**
    - Layer: Strategic (monthly)
    - Detects: Best-performing content formats (listicles, guides, videos)
    - Data: GA4 engagement × conversion by content type
    - Threshold: Format converts >2x average = double down
    - Action: Create more of winning format, test new variations

39. **detect_content_topic_winner_identification**
    - Layer: Strategic (monthly)
    - Detects: Topics driving disproportionate conversions
    - Data: GA4 content grouping × conversion rates
    - Threshold: Topic drives >10% of conversions from <5% traffic = scale
    - Action: Create more content in winning topic, build clusters

40. **detect_content_roi_by_piece**
    - Layer: Strategic (quarterly)
    - Detects: Content ROI (production cost vs. revenue generated)
    - Data: Content creation cost + attributed revenue
    - Threshold: ROI <1.0 after 90 days = stop similar, >5.0 = create more
    - Action: Double down on high-ROI topics, cut low performers

41. **detect_content_update_opportunity**
    - Layer: Strategic (monthly)
    - Detects: Old content that would benefit from refresh based on traffic potential
    - Data: Historical traffic peak × current traffic × search volume
    - Threshold: Lost >50% of peak traffic, search volume still high = refresh
    - Action: Update statistics, expand sections, add new examples, re-promote

#### 🟢 LOW PRIORITY (1 detector):
42. **detect_content_social_share_potential**
    - Layer: Strategic (monthly)
    - Detects: Content performing well but not being shared socially
    - Data: GA4 traffic/engagement × social shares
    - Threshold: High engagement, low shares = promote socially
    - Action: Add share buttons, create social snippets, promote to influencers

---

## 🚦 TRAFFIC & CHANNEL ATTRIBUTION (Need 9 more → Total: 18)

### Currently Have (9):
✅ detect_cross_channel_gaps  
✅ detect_declining_performers  
✅ detect_declining_performers_multitimeframe  
✅ detect_traffic_source_disappearance *(expansion)*  
✅ detect_channel_dependency_risk *(expansion)*  
✅ detect_traffic_quality_by_source *(expansion)*  
✅ detect_cac_by_channel *(expansion)*  
✅ detect_revenue_by_channel_attribution *(expansion)*  
✅ detect_multitouch_conversion_path_issues *(expansion - partial)*

### Need to Build:

#### 🔴 HIGH PRIORITY (4 detectors):
43. **detect_channel_cac_above_ltv**
    - Layer: Fast (daily)
    - Detects: Channels where acquisition cost exceeds customer lifetime value
    - Data: Marketing spend by channel × Stripe LTV
    - Threshold: CAC > LTV = stop spending, CAC > 0.5×LTV = risky
    - Action: Pause channel, improve targeting, reduce bids

44. **detect_channel_mix_shift_impact**
    - Layer: Fast (daily)
    - Detects: Traffic source mix changing in ways that hurt overall metrics
    - Data: GA4 traffic source × conversion rates
    - Threshold: High-CVR channel drops >20% = investigate cause
    - Action: Check if campaigns paused, rankings dropped, investigate source

45. **detect_bot_spam_traffic_spike**
    - Layer: Fast (daily)
    - Detects: Non-human traffic inflating metrics
    - Data: GA4 bounce rate, session duration, pages/session by source
    - Threshold: >50% bounce, <10s duration, 1 page/session = bot traffic
    - Action: Block IPs, add filters, report to ad platform

46. **detect_unexpected_traffic_spike_quality_check**
    - Layer: Fast (daily)
    - Detects: Traffic spike with poor engagement (viral link, bot attack)
    - Data: GA4 sessions surge + engagement metrics
    - Threshold: Sessions +200% with bounce >80% = investigate
    - Action: Check source, verify quality, capitalize if legitimate

#### 🟡 MEDIUM PRIORITY (4 detectors):
47. **detect_channel_assist_value**
    - Layer: Strategic (monthly)
    - Detects: Channels undervalued in last-click attribution but assist conversions
    - Data: GA4 multi-touch conversion paths
    - Threshold: Channel assists >30% of conversions but gets <10% credit = revalue
    - Action: Adjust attribution model, increase investment in assist channels

48. **detect_utm_parameter_tracking_gaps**
    - Layer: Trend (weekly)
    - Detects: Traffic without proper UTM tagging (attribution blind spots)
    - Data: GA4 traffic without campaign/source/medium
    - Threshold: >15% of traffic untagged = fix tracking
    - Action: Implement UTM standards, tag all campaigns, audit links

49. **detect_channel_saturation_point**
    - Layer: Strategic (monthly)
    - Detects: Channels hitting diminishing returns (more spend = worse ROI)
    - Data: Spend vs conversions over time by channel
    - Threshold: 20% spend increase yields <10% conversion increase = saturated
    - Action: Diversify channels, test new audiences, improve creative

50. **detect_referral_source_opportunities**
    - Layer: Strategic (monthly)
    - Detects: Referral sources converting well but low volume
    - Data: GA4 referrals × conversion rates
    - Threshold: CVR >2x average but <1% of traffic = scale opportunity
    - Action: Build relationship, create more referral-worthy content, partnerships

#### 🟢 LOW PRIORITY (1 detector):
51. **detect_direct_traffic_misattribution**
    - Layer: Strategic (quarterly)
    - Detects: "Direct" traffic increasing (usually misattributed)
    - Data: GA4 direct traffic as % of total
    - Threshold: Direct >30% and increasing = attribution problem
    - Action: Improve tracking, implement UTM parameters, check dark social

---

## 💵 REVENUE & METRICS (Need 11 more → Total: 20)

### Currently Have (9):
✅ detect_revenue_anomaly  
✅ detect_metric_anomalies  
✅ detect_revenue_trends_multitimeframe  
✅ detect_mrr_arr_tracking *(expansion)*  
✅ detect_transaction_refund_anomalies *(expansion)*  
✅ detect_revenue_forecast_deviation *(expansion)*  
✅ detect_unit_economics_dashboard *(expansion - partial)*  
✅ detect_growth_velocity_trends *(expansion)*  
✅ detect_cohort_performance_trends *(expansion)*

### Need to Build:

#### 🔴 HIGH PRIORITY (5 detectors):
52. **detect_mrr_churn_spike**
    - Layer: Fast (daily)
    - Detects: MRR churn increasing above normal
    - Data: Stripe subscription cancellations × MRR impact
    - Threshold: Churn >5% monthly or +50% vs last month = investigate
    - Action: Identify churn cohort, reach out, improve retention tactics

53. **detect_payment_failure_rate_increase**
    - Layer: Fast (daily)
    - Detects: Failed payments increasing (billing issues)
    - Data: Stripe failed charges
    - Threshold: Failure rate >5% or +100% vs baseline = fix
    - Action: Update payment methods, retry logic, communicate with customers

54. **detect_average_order_value_decline**
    - Layer: Trend (weekly)
    - Detects: AOV trending down vs. historical
    - Data: Stripe transaction amounts
    - Threshold: AOV drops >15% vs 30d avg = investigate
    - Action: Check discounting, product mix, upsell effectiveness

55. **detect_new_customer_revenue_decline**
    - Layer: Trend (weekly)
    - Detects: Revenue from new customers dropping (acquisition quality issue)
    - Data: Stripe first-time customer revenue
    - Threshold: New customer revenue down >20% = traffic quality problem
    - Action: Check traffic sources, improve targeting, qualify leads better

56. **detect_expansion_revenue_opportunity**
    - Layer: Strategic (monthly)
    - Detects: Customers not upgrading or expanding usage
    - Data: Stripe upgrade rate, usage data
    - Threshold: <10% of customers upgrade within 90d = improve upsell
    - Action: Add upgrade prompts, improve onboarding, test pricing

#### 🟡 MEDIUM PRIORITY (4 detectors):
57. **detect_revenue_concentration_risk**
    - Layer: Strategic (monthly)
    - Detects: Too much revenue from too few customers
    - Data: Stripe customer revenue distribution
    - Threshold: Top 10% customers = >50% revenue = risky
    - Action: Diversify customer base, improve acquisition, reduce churn risk

58. **detect_ltv_cac_ratio_decline**
    - Layer: Strategic (monthly)
    - Detects: LTV:CAC ratio declining (unit economics worsening)
    - Data: Stripe LTV × marketing spend for cohorts
    - Threshold: LTV:CAC <3.0 = unprofitable growth
    - Action: Improve retention, reduce CAC, increase prices, improve onboarding

59. **detect_cohort_performance_divergence**
    - Layer: Strategic (monthly)
    - Detects: Recent cohorts underperforming vs. historical
    - Data: Stripe cohort analysis by signup month
    - Threshold: Latest cohorts <70% of avg cohort value = quality issue
    - Action: Check acquisition changes, improve onboarding, qualify better

60. **detect_discount_cannibalization**
    - Layer: Strategic (monthly)
    - Detects: Discounts not driving incremental revenue (would've bought anyway)
    - Data: Stripe purchases with/without discounts × conversion timing
    - Threshold: Discount usage >30% with no lift in total revenue = stop
    - Action: Test removing discounts, target discounts better, add scarcity

#### 🟢 LOW PRIORITY (2 detectors):
61. **detect_revenue_seasonality_deviation**
    - Layer: Strategic (monthly)
    - Detects: Revenue not following expected seasonal patterns
    - Data: Stripe revenue by month vs. historical seasonality
    - Threshold: >20% deviation from expected seasonal pattern = investigate
    - Action: Check if market shifted, competitive pressure, internal changes

62. **detect_payment_method_performance_gaps**
    - Layer: Strategic (monthly)
    - Detects: Some payment methods converting better than others
    - Data: Stripe payment methods × conversion completion
    - Threshold: Method with >20% better completion rate = promote
    - Action: Make preferred methods more prominent, test incentives

---

## 🎯 CROSS-CUTTING DETECTORS (Need 15 more → Total: 15)

### Currently Have (0):
None - these are net-new detector types

### Need to Build:

#### 🔴 HIGH PRIORITY (8 detectors):
63. **detect_data_freshness_issues**
    - Layer: Fast (hourly)
    - Detects: Data pipelines delayed or failing
    - Data: BigQuery table update timestamps
    - Threshold: >6 hours delayed = alert
    - Action: Check ETL jobs, investigate pipeline failures

64. **detect_entity_mapping_quality_decline**
    - Layer: Trend (weekly)
    - Detects: Entity mapping failures increasing (canonical_entity_id nulls)
    - Data: entity_map join success rate
    - Threshold: >5% unmapped = investigate
    - Action: Fix mapping rules, add new patterns, backfill

65. **detect_metric_calculation_errors**
    - Layer: Fast (daily)
    - Detects: Calculated metrics producing impossible values
    - Data: All calculated fields (CVR, ROAS, etc.)
    - Threshold: CVR >100%, negative revenue, null spikes = bug
    - Action: Fix calculation logic, validate data quality

66. **detect_data_source_disconnection**
    - Layer: Fast (real-time)
    - Detects: API connections to data sources failing
    - Data: Sync logs, API response codes
    - Threshold: 3 consecutive failures = reconnect needed
    - Action: Refresh tokens, check API status, fix authentication

67. **detect_baseline_recalibration_needed**
    - Layer: Strategic (monthly)
    - Detects: Baselines outdated (business has fundamentally changed)
    - Data: Current performance vs. baseline definitions
    - Threshold: Sustained >30% above/below baseline = recalibrate
    - Action: Update baseline calculations, adjust thresholds

68. **detect_seasonal_baseline_adjustment**
    - Layer: Strategic (monthly)
    - Detects: Seasonal patterns not reflected in baselines
    - Data: Year-over-year patterns
    - Threshold: Same month last year ±20% vs current baseline = seasonal
    - Action: Apply seasonal adjustment factors to thresholds

69. **detect_competitor_benchmark_gaps**
    - Layer: Strategic (quarterly)
    - Detects: Underperforming vs. competitor benchmarks
    - Data: External benchmark data (SimilarWeb, industry reports)
    - Threshold: >30% below competitor average in key metrics = gap
    - Action: Analyze competitor tactics, test similar strategies

70. **detect_opportunity_staleness**
    - Layer: Fast (daily)
    - Detects: Opportunities detected but not actioned after X days
    - Data: Firestore opportunities × status × age
    - Threshold: >30 days old with status=new = stale
    - Action: Auto-archive, reprioritize, or escalate

#### 🟡 MEDIUM PRIORITY (5 detectors):
71. **detect_false_positive_pattern**
    - Layer: Strategic (monthly)
    - Detects: Detectors firing incorrectly (noise, not signal)
    - Data: Opportunities marked "false_positive" or "dismissed"
    - Threshold: >40% dismissal rate on a detector = tune it
    - Action: Adjust thresholds, improve logic, add filters

72. **detect_recommendation_success_rate**
    - Layer: Strategic (monthly)
    - Detects: Recommended actions not working as expected
    - Data: Opportunities actioned × actual lift vs predicted
    - Threshold: Actual lift <50% of predicted = recalibrate
    - Action: Improve prediction models, adjust confidence scores

73. **detect_multi_detector_convergence**
    - Layer: Trend (weekly)
    - Detects: Multiple detectors flagging same entity (high-priority issue)
    - Data: Opportunities by entity_id
    - Threshold: 3+ detectors on same entity = urgent, compound issue
    - Action: Prioritize, investigate root cause, coordinate fixes

74. **detect_detector_coverage_gaps**
    - Layer: Strategic (quarterly)
    - Detects: Entities never flagged by any detector (blind spots)
    - Data: Entities with 0 opportunities ever detected
    - Threshold: High-volume entities with no flags = add monitoring
    - Action: Create detectors for uncovered entity types

75. **detect_alert_fatigue_risk**
    - Layer: Strategic (monthly)
    - Detects: Too many opportunities, user overwhelm
    - Data: Opportunities per week × dismissal rate
    - Threshold: >50 opportunities/week with >60% dismissal = noise
    - Action: Increase thresholds, reduce sensitivity, focus on highest priority

#### 🟢 LOW PRIORITY (2 detectors):
76. **detect_external_event_correlation**
    - Layer: Strategic (ad-hoc)
    - Detects: Performance changes correlated with external events
    - Data: Performance changes × news/events API
    - Threshold: Significant change + major news event = context
    - Action: Provide context in opportunity, adjust expectations

77. **detect_organizational_capacity_constraints**
    - Layer: Strategic (monthly)
    - Detects: More opportunities than team can act on
    - Data: Opportunities generated vs. team size/velocity
    - Threshold: Opportunity backlog >20 = focus on quick wins only
    - Action: Prioritize ruthlessly, auto-archive low-priority

---

## 📊 SUMMARY: COMPLETE BUILD LIST

### Total Detectors Needed for 85% Coverage:

| Area | Have | Need | Total Target |
|------|------|------|--------------|
| **Email** | 6 | +7 | 13 |
| **SEO** | 9 | +8 | 17 |
| **Advertising** | 9 | +10 | 19 |
| **Pages/CRO** | 9 | +8 | 17 |
| **Content** | 4 | +9 | 13 |
| **Traffic** | 9 | +9 | 18 |
| **Revenue** | 9 | +11 | 20 |
| **Cross-Cutting** | 0 | +15 | 15 |
| **TOTAL** | **55** | **+77** | **132** |

---

## 🗓️ RECOMMENDED BUILD SCHEDULE

### Phase 1: Critical Gaps (Weeks 1-4) - 20 detectors
**Focus:** Real-time alerts, crisis prevention, fast detection

Priority detectors:
- All 🔴 HIGH PRIORITY items (33 total)
- Select top 20 by business impact

**Target:** 75 total detectors, 50% coverage

---

### Phase 2: Strategic Gaps (Weeks 5-8) - 25 detectors
**Focus:** Gap detection, benchmarking, optimization opportunities

Priority detectors:
- All 🟡 MEDIUM PRIORITY items (29 total)
- Select top 25 by value

**Target:** 100 total detectors, 70% coverage

---

### Phase 3: Advanced Intelligence (Weeks 9-12) - 20 detectors
**Focus:** Predictive, attribution, advanced analytics

Priority detectors:
- 🟢 LOW PRIORITY items (15 total)
- Cross-cutting detectors (15 total)
- Select top 20 for completion

**Target:** 120 total detectors, 85% coverage

---

## 💡 IMPLEMENTATION NOTES

1. **Don't build all at once** - Focus on high-impact areas first
2. **Test with real data** - Some detectors may not be relevant for your business
3. **Iterate on thresholds** - Start conservative, tune based on false positive rate
4. **Consider data availability** - Some require data sources you may not have yet
5. **Prioritize by business model** - E-commerce needs different detectors than SaaS

---

**Next Step:** Review this list and select which Phase 1 detectors (🔴 HIGH) to build first based on your current business priorities.
