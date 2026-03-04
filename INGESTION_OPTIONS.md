# MySQL Table Ingestion Options
## What to Ingest Next

Based on our database analysis, here are your options organized by priority and business value.

---

## 🔥 **PRIORITY 1: Conversion Events** (Recommended Next)
### **High Impact, Low Effort - Do These First**

### 1. **`bookings` Table** ⭐⭐⭐⭐⭐
**What it is:** Calendly/calendar booking events (sales calls, consultations)

**Why it matters:**
- Track **sales call conversions** (high-intent signal)
- Calculate **booking → purchase** conversion rate
- Identify which campaigns drive the most qualified leads
- Measure sales team effectiveness

**Schema:**
- `id`, `booker_id`, `bookable_id`, `event_type_id`, `status`, `start_time`, `end_time`, `created_at`, `updated_at`

**Example Use Cases:**
```sql
-- Which PPC campaigns drive the most sales calls?
-- What's the booking → purchase conversion rate?
-- How long from booking to purchase?
```

**Effort:** 30 minutes  
**Value:** Very High (conversion funnel visibility)

---

### 2. **`one_click_hirings` Table** ⭐⭐⭐⭐⭐
**What it is:** Instant hire conversion events

**Why it matters:**
- **Highest-value conversion** (direct hire without job posting)
- Track which channels drive instant hires
- Calculate LTV of one-click hire customers
- Measure one-click hire effectiveness

**Schema:**
- `id`, `company_id`, `user_id`, `status`, `amount`, `created_at`, `updated_at`

**Example Use Cases:**
```sql
-- Which companies use one-click hiring?
-- What's the average revenue from one-click hires?
-- Which traffic sources lead to instant hires?
```

**Effort:** 30 minutes  
**Value:** Very High (premium conversion event)

---

## 📈 **PRIORITY 2: Pre-Calculated Metrics** (Quick Wins)
### **Instant Insights, Zero Computation**

### 3. **`companies_ltv` Table** ⭐⭐⭐⭐
**What it is:** Pre-calculated Customer Lifetime Value

**Why it matters:**
- **LTV already calculated** (no need to compute)
- Instant segmentation by LTV
- Track LTV by acquisition channel
- Identify high-value customer patterns

**Schema:**
- `Category`, `Count of Verified Companies`, `Total Payment`, `ARPU`

**Example Use Cases:**
```sql
-- What's the LTV of PPC customers vs. Organic?
-- Which campaigns drive the highest LTV customers?
-- LTV by company category/size
```

**Effort:** 20 minutes  
**Value:** High (instant LTV analysis)

---

### 4. **`companies_rfm` Table** ⭐⭐⭐⭐
**What it is:** RFM (Recency, Frequency, Monetary) scores for companies

**Why it matters:**
- **Customer segmentation** already calculated
- Identify "Champions", "At-Risk", "Lost" customers
- Target re-engagement campaigns
- Predict churn

**Schema:**
- `company_id`, `r_score`, `f_score`, `m_score`, `rfm_segment`

**Example Use Cases:**
```sql
-- Which PPC campaigns bring "Champion" customers?
-- Re-engage "At-Risk" high-value customers
-- Churn prediction by acquisition source
```

**Effort:** 20 minutes  
**Value:** High (instant segmentation)

---

### 5. **`users_rfm` / `users_rfm_new` Tables** ⭐⭐⭐⭐
**What it is:** RFM scores for talent (users)

**Why it matters:**
- Talent engagement scoring
- Identify most active/valuable talent
- Target re-engagement campaigns for talent
- Measure talent quality by source

**Effort:** 20 minutes  
**Value:** High (talent engagement insights)

---

### 6. **`user_stats` Table** ⭐⭐⭐
**What it is:** Additional user engagement metrics + Mautic ID

**Why it matters:**
- Links to **Mautic email marketing** platform
- Email campaign attribution
- Additional engagement signals
- Cross-platform tracking

**Schema:**
- `user_id`, `mautic_id`, `engagement_score`, `last_active`, `created_at`

**Example Use Cases:**
```sql
-- Which email campaigns drive revenue?
-- Email → Purchase attribution
-- Engagement scoring by acquisition source
```

**Effort:** 20 minutes  
**Value:** Medium-High (email attribution)

---

### 7. **`users_kpi` Table** ⭐⭐⭐
**What it is:** 24 comprehensive user KPIs

**Why it matters:**
- **24 KPIs** already calculated
- Engagement, activity, quality metrics
- Talent scoring
- Predictive analytics

**Effort:** 30 minutes  
**Value:** High (comprehensive metrics)

---

## 🎁 **PRIORITY 3: Marketing Attribution**
### **Referrals, Coupons, and Promo Effectiveness**

### 8. **`affiliates` Table** ⭐⭐⭐
**What it is:** Affiliate/referral program data

**Why it matters:**
- Track **referral revenue**
- Identify top referrers
- Calculate referral ROI
- Measure viral coefficient

**Schema:**
- `id`, `owner_id`, `referral_code`, `total_referrals`, `total_revenue`, `created_at`

**Example Use Cases:**
```sql
-- Which affiliates drive the most revenue?
-- Referral revenue vs. paid acquisition cost
-- Top referral sources
```

**Effort:** 30 minutes  
**Value:** Medium (if affiliate program is active)

---

### 9. **`stripe_coupons` Table** ⭐⭐⭐
**What it is:** Coupon/promo code definitions

**Why it matters:**
- Track promo code usage
- Measure discount effectiveness
- Calculate discount ROI
- A/B test promotions

**Schema:**
- `id`, `stripe_id`, `code`, `amount_off`, `percent_off`, `duration`, `status`, `created_at`

**Effort:** 20 minutes  
**Value:** Medium-High (promo effectiveness)

---

### 10. **`couponables` Table** ⭐⭐⭐
**What it is:** Tracks which purchases used coupons

**Why it matters:**
- Link coupons to actual purchases
- Track coupon attribution
- Measure discount impact on conversion
- Calculate incremental revenue from promos

**Schema:**
- `stripe_coupon_id`, `couponable_id`, `couponable_type`, `created_at`

**Example Use Cases:**
```sql
-- Which coupons drive the most revenue?
-- Do discounts increase LTV or just attract price-sensitive customers?
-- Coupon usage by acquisition channel
```

**Effort:** 30 minutes  
**Value:** High (if running promos)

---

## 💰 **PRIORITY 4: Payment Details**
### **Deep Dive into Payment Behavior**

### 11. **`charges` Table** ⭐⭐⭐
**What it is:** Detailed Stripe charge records

**Why it matters:**
- Track **payment failures**
- Refund analysis
- Payment method performance
- Dispute tracking

**Schema:**
- `stripe_id`, `payment_intent_id`, `amount`, `amount_captured`, `amount_refunded`, `status`, `failure_code`, `failure_message`

**Example Use Cases:**
```sql
-- Payment failure rate by campaign
-- Refund analysis
-- Which payment methods have highest success rate?
```

**Effort:** 30 minutes  
**Value:** Medium (operational insights)

---

### 12. **`payment_intents` Table** ⭐⭐
**What it is:** Stripe payment intent lifecycle

**Why it matters:**
- Track payment attempts vs. completions
- Abandoned checkout analysis
- Payment flow optimization
- Fraud detection signals

**Effort:** 30 minutes  
**Value:** Medium (conversion optimization)

---

## ⭐ **PRIORITY 5: Social Proof**
### **Trust Signals and NPS**

### 13. **`vouches` Table** ⭐⭐
**What it is:** User endorsements/vouches

**Why it matters:**
- Social proof metrics
- Trust signal tracking
- Endorsement network analysis
- Quality indicator

**Effort:** 20 minutes  
**Value:** Low-Medium (nice-to-have)

---

### 14. **`testimonials` Table** ⭐⭐
**What it is:** Written testimonials/reviews

**Why it matters:**
- Customer satisfaction tracking
- NPS-like scoring
- Sentiment analysis
- Social proof content

**Effort:** 20 minutes  
**Value:** Low-Medium (nice-to-have)

---

### 15. **`feedback` Table** ⭐⭐
**What it is:** General user feedback

**Why it matters:**
- Product feedback
- Feature requests
- Bug reports
- User sentiment

**Effort:** 20 minutes  
**Value:** Low-Medium (product insights)

---

## 🏆 **PRIORITY 6: Gamification**
### **Engagement Drivers**

### 16. **`leaderboards` + `badges` + `users_badges` Tables** ⭐⭐
**What it is:** Gamification system data

**Why it matters:**
- Track gamification effectiveness
- Engagement lift from badges
- Leaderboard participation
- Achievement unlocks

**Effort:** 40 minutes (3 tables)  
**Value:** Low (unless gamification is key strategy)

---

## 🎯 **RECOMMENDED IMPLEMENTATION ORDER**

### **Phase 1: Conversion Events** (Week 1)
```
1. bookings              → 30 min
2. one_click_hirings     → 30 min
TOTAL: 1 hour
```
**Impact:** Immediate visibility into conversion funnel

---

### **Phase 2: Pre-Calculated Metrics** (Week 2)
```
3. companies_ltv         → 20 min
4. companies_rfm         → 20 min
5. users_rfm             → 20 min
6. user_stats            → 20 min
7. users_kpi             → 30 min
TOTAL: 1.5 hours
```
**Impact:** Instant LTV, RFM, and engagement insights

---

### **Phase 3: Marketing Attribution** (Week 3)
```
8. affiliates            → 30 min
9. stripe_coupons        → 20 min
10. couponables          → 30 min
TOTAL: 1.5 hours
```
**Impact:** Complete marketing attribution picture

---

### **Phase 4: Payment Details** (Week 4)
```
11. charges              → 30 min
12. payment_intents      → 30 min
TOTAL: 1 hour
```
**Impact:** Payment optimization and failure analysis

---

## 💡 **QUICK WINS - Do These First**

If you want **maximum impact with minimum effort**, start with:

### **Top 3 Quick Wins:**
1. ✅ **`bookings`** (30 min) → Sales call conversion tracking
2. ✅ **`companies_ltv`** (20 min) → Instant LTV by channel
3. ✅ **`companies_rfm`** (20 min) → Customer segmentation

**Total Time:** 70 minutes  
**Impact:** Massive (conversion funnel + LTV + segmentation)

---

## 🔧 **Implementation Pattern**

For each table, the pattern is the same:

### **Step 1: Add to ytjobs-mysql-bigquery-sync/main.py**
```python
# ============================================
# N. TABLE_NAME
# ============================================
logger.info("Fetching {table_name}...")
cursor.execute("""
    SELECT *
    FROM {table_name}
    WHERE created_at >= %s AND created_at < %s
""", (start_date, end_date + timedelta(days=1)))

for row in cursor.fetchall():
    rows.append({
        'organization_id': 'ytjobs',
        'date': row['created_at'].date().isoformat(),
        'canonical_entity_id': f"{table_name}_{row['id']}",
        'entity_type': '{table_name}',
        'conversions': 1,  # or other metric
        'source_breakdown': to_json({
            # Include relevant fields
        }),
        'created_at': now_iso,
        'updated_at': now_iso,
    })
```

### **Step 2: Deploy**
```bash
cd cloud-functions/data-sync/ytjobs-mysql-bigquery-sync
bash deploy.sh
```

### **Step 3: Trigger Sync**
```bash
curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/ytjobs-mysql-bigquery-sync \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "ytjobs", "mode": "update", "daysBack": 30}'
```

---

## 📊 **Expected Results Per Table**

| Table | Est. Records/Day | Data Volume | Query Complexity |
|-------|------------------|-------------|------------------|
| `bookings` | ~5-20 | Low | Simple |
| `one_click_hirings` | ~1-5 | Very Low | Simple |
| `companies_ltv` | Static (~3,826 rows) | Low | Very Simple |
| `companies_rfm` | Static (~3,826 rows) | Low | Very Simple |
| `users_rfm` | Static (~12,751 rows) | Low | Very Simple |
| `user_stats` | ~12,751 rows | Medium | Medium |
| `users_kpi` | ~12,751 rows | Medium | Simple |
| `affiliates` | ~10-50 | Low | Simple |
| `stripe_coupons` | Static (~100?) | Very Low | Simple |
| `couponables` | ~5-20 | Low | Simple |
| `charges` | ~50-100 | Medium | Medium |
| `payment_intents` | ~50-100 | Medium | Medium |

---

## 🎯 **My Recommendation**

**Start with Phase 1 (Conversion Events):**

1. ✅ `bookings` - See which campaigns drive sales calls
2. ✅ `one_click_hirings` - Track premium conversions

**Then Phase 2 (Quick Wins):**

3. ✅ `companies_ltv` - Instant LTV by channel
4. ✅ `companies_rfm` - Customer segmentation

**Total Time:** ~2 hours  
**Total Impact:** 🚀🚀🚀🚀🚀

This gives you:
- Complete conversion funnel visibility
- LTV attribution by channel
- Customer segmentation
- Foundation for advanced analytics

---

Would you like me to implement any of these? I can start with the top 3-4 quick wins if you'd like!
