import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "opsos-864a1";
const DATASET = "reporting";
const BQ_LOCATION = "northamerica-northeast1";

// ─── Metric registry (stage/section structure) ────────────────────────────────
// Mirrors marketing_ai.metric_registry in BigQuery.
// Each entry: [stage, section, bq_field, unit, is_higher_better, trend_fields]
// trend_fields are the BQ column names for dod / 7d_avg / wow_pct variants.

type MetricDef = {
  stage: string;
  section: string;
  label: string;
  user_type: string;
  unit: string;
  is_higher_better: boolean | null;
  display_format: string;
  appears_in: string[];
  trend_fields: string[];
};

const METRIC_REGISTRY: Record<string, MetricDef> = {
  // ACQUISITION / paid_ads
  ad_spend:               { stage:"acquisition", section:"paid_ads",        label:"Ad Spend",               user_type:"both",    unit:"currency",   is_higher_better:false, display_format:"$%.0f",   appears_in:["acquisition.paid_ads"],                              trend_fields:["ad_spend_dod","ad_spend_7d_avg"] },
  roas:                   { stage:"acquisition", section:"paid_ads",        label:"ROAS",                   user_type:"both",    unit:"ratio",      is_higher_better:true,  display_format:"%.2fx",   appears_in:["acquisition.paid_ads","active_users.revenue"],       trend_fields:[] },
  ppc_revenue:            { stage:"acquisition", section:"paid_ads",        label:"PPC Revenue",            user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["acquisition.paid_ads","active_users.revenue"],       trend_fields:[] },
  ppc_purchases:          { stage:"acquisition", section:"paid_ads",        label:"PPC Purchases",          user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads","active_users.revenue"],       trend_fields:[] },
  gads_sessions:          { stage:"acquisition", section:"paid_ads",        label:"Google Ads Sessions",    user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads","acquisition.traffic"],        trend_fields:[] },
  gads_users:             { stage:"acquisition", section:"paid_ads",        label:"Google Ads Users",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  gads_conversions:       { stage:"acquisition", section:"paid_ads",        label:"Google Ads Conversions", user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  gads_revenue:           { stage:"acquisition", section:"paid_ads",        label:"Google Ads Revenue",     user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["acquisition.paid_ads","active_users.revenue"],       trend_fields:[] },
  gads_pmax_sessions:     { stage:"acquisition", section:"paid_ads",        label:"PMax Sessions",          user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  gads_pmax_conversions:  { stage:"acquisition", section:"paid_ads",        label:"PMax Conversions",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  gads_search_sessions:   { stage:"acquisition", section:"paid_ads",        label:"Search Sessions",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  gads_search_conversions:{ stage:"acquisition", section:"paid_ads",        label:"Search Conversions",     user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.paid_ads"],                              trend_fields:[] },
  // ACQUISITION / traffic
  sessions:               { stage:"acquisition", section:"traffic",          label:"Total Sessions",         user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:["sessions_dod","sessions_7d_avg","sessions_wow_pct"] },
  engaged_sessions:       { stage:"acquisition", section:"traffic",          label:"Engaged Sessions",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  engagement_rate_pct:    { stage:"acquisition", section:"traffic",          label:"Engagement Rate",        user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  new_users:              { stage:"acquisition", section:"traffic",          label:"New Users",              user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  total_events:           { stage:"acquisition", section:"traffic",          label:"Total Events",           user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  events_per_session:     { stage:"acquisition", section:"traffic",          label:"Events / Session",       user_type:"both",    unit:"ratio",      is_higher_better:true,  display_format:"%.1f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  key_events:             { stage:"acquisition", section:"traffic",          label:"Key Events",             user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  organic_sessions:       { stage:"acquisition", section:"traffic",          label:"Organic Sessions",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_search_sessions:   { stage:"acquisition", section:"traffic",          label:"Paid Search Sessions",   user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_pmax_sessions:     { stage:"acquisition", section:"traffic",          label:"PMax Sessions (GA4)",    user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  total_paid_sessions:    { stage:"acquisition", section:"traffic",          label:"Total Paid Sessions",    user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  direct_sessions:        { stage:"acquisition", section:"traffic",          label:"Direct Sessions",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  referral_sessions:      { stage:"acquisition", section:"traffic",          label:"Referral Sessions",      user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  social_sessions:        { stage:"acquisition", section:"traffic",          label:"Social Sessions",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  email_traffic_sessions: { stage:"acquisition", section:"traffic",          label:"Email Traffic Sessions",  user_type:"both",   unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  video_sessions:         { stage:"acquisition", section:"traffic",          label:"Video Sessions",         user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  organic_engaged_sessions:       { stage:"acquisition", section:"traffic",  label:"Organic Engaged",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_search_engaged_sessions:   { stage:"acquisition", section:"traffic",  label:"Paid Search Engaged",    user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_pmax_engaged_sessions:     { stage:"acquisition", section:"traffic",  label:"PMax Engaged",           user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.traffic"],                               trend_fields:[] },
  organic_engagement_rate:        { stage:"acquisition", section:"traffic",  label:"Organic Engagement Rate",user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_engagement_rate:           { stage:"acquisition", section:"traffic",  label:"Paid Engagement Rate",   user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  organic_pct:            { stage:"acquisition", section:"traffic",          label:"Organic %",              user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  paid_pct:               { stage:"acquisition", section:"traffic",          label:"Paid %",                 user_type:"both",    unit:"percentage", is_higher_better:null,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  direct_pct:             { stage:"acquisition", section:"traffic",          label:"Direct %",               user_type:"both",    unit:"percentage", is_higher_better:null,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  referral_pct:           { stage:"acquisition", section:"traffic",          label:"Referral %",             user_type:"both",    unit:"percentage", is_higher_better:null,  display_format:"%.1f%%",  appears_in:["acquisition.traffic"],                               trend_fields:[] },
  ga4_revenue:            { stage:"acquisition", section:"traffic",          label:"GA4 Revenue",            user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["acquisition.traffic","active_users.revenue"],        trend_fields:[] },
  revenue_per_session:    { stage:"acquisition", section:"traffic",          label:"Revenue / Session",      user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.2f",   appears_in:["acquisition.traffic","active_users.revenue"],        trend_fields:[] },
  // ACQUISITION / email
  marketing_campaigns_launched:   { stage:"acquisition", section:"email",    label:"Marketing Campaigns",    user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  marketing_sends:                { stage:"acquisition", section:"email",    label:"Marketing Sends",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  marketing_opens:                { stage:"acquisition", section:"email",    label:"Marketing Opens",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  marketing_clicks:               { stage:"acquisition", section:"email",    label:"Marketing Clicks",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  marketing_avg_open_rate:        { stage:"acquisition", section:"email",    label:"Marketing Open Rate",    user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  marketing_avg_ctr:              { stage:"acquisition", section:"email",    label:"Marketing CTR",          user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_campaigns_launched:  { stage:"acquisition", section:"email",    label:"Automation Campaigns",   user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_sends:               { stage:"acquisition", section:"email",    label:"Automation Sends",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_opens:               { stage:"acquisition", section:"email",    label:"Automation Opens",       user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_clicks:              { stage:"acquisition", section:"email",    label:"Automation Clicks",      user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_avg_open_rate:       { stage:"acquisition", section:"email",    label:"Automation Open Rate",   user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  automation_avg_ctr:             { stage:"acquisition", section:"email",    label:"Automation CTR",         user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaigns_launched:             { stage:"acquisition", section:"email",    label:"Total Campaigns",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_lifetime_sends:        { stage:"acquisition", section:"email",    label:"Lifetime Sends",         user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_lifetime_opens:        { stage:"acquisition", section:"email",    label:"Lifetime Opens",         user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_lifetime_clicks:       { stage:"acquisition", section:"email",    label:"Lifetime Clicks",        user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_avg_open_rate:         { stage:"acquisition", section:"email",    label:"Campaign Open Rate",     user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_avg_ctr:               { stage:"acquisition", section:"email",    label:"Campaign CTR",           user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  campaign_click_to_open_pct:     { stage:"acquisition", section:"email",    label:"Click-to-Open Rate",     user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_contacts_total:           { stage:"acquisition", section:"email",    label:"Email Contacts",         user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_list_subscribers_total:   { stage:"acquisition", section:"email",    label:"Email Subscribers",      user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_daily_opens:              { stage:"acquisition", section:"email",    label:"Daily Opens",            user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_daily_unique_openers:     { stage:"acquisition", section:"email",    label:"Daily Unique Openers",   user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_daily_clicks:             { stage:"acquisition", section:"email",    label:"Daily Email Clicks",     user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  email_daily_unique_clickers:    { stage:"acquisition", section:"email",    label:"Daily Unique Clickers",  user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["acquisition.email"],                                 trend_fields:[] },
  // ONBOARDING / talent
  talent_signups:         { stage:"onboarding",   section:"talent",          label:"Talent Signups",         user_type:"talent",  unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["onboarding.talent","onboarding.combined"],           trend_fields:["talent_signups_dod","talent_signups_7d_avg","talent_signups_wow_pct"] },
  talent_signup_rate_pct: { stage:"onboarding",   section:"talent",          label:"Talent Signup Rate",     user_type:"talent",  unit:"percentage", is_higher_better:true,  display_format:"%.2f%%",  appears_in:["onboarding.talent"],                                 trend_fields:[] },
  revenue_per_talent_signup:{ stage:"onboarding", section:"talent",          label:"Revenue / Talent Signup",user_type:"talent",  unit:"currency",   is_higher_better:true,  display_format:"$%.2f",   appears_in:["onboarding.talent"],                                 trend_fields:[] },
  // ONBOARDING / company
  company_signups:        { stage:"onboarding",   section:"company",         label:"Company Signups",        user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["onboarding.company","onboarding.combined"],          trend_fields:["company_signups_dod","company_signups_7d_avg"] },
  company_signup_rate_pct:{ stage:"onboarding",   section:"company",         label:"Company Signup Rate",    user_type:"company", unit:"percentage", is_higher_better:true,  display_format:"%.2f%%",  appears_in:["onboarding.company"],                                trend_fields:[] },
  cumulative_company_signups:{ stage:"onboarding",section:"company",         label:"Cumulative Co. Signups", user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["onboarding.company"],                                trend_fields:[] },
  // ONBOARDING / combined
  total_signups:          { stage:"onboarding",   section:"combined",        label:"Total Signups",          user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["onboarding.combined","onboarding.talent","onboarding.company"], trend_fields:[] },
  overall_signup_rate_pct:{ stage:"onboarding",   section:"combined",        label:"Overall Signup Rate",    user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.2f%%",  appears_in:["onboarding.combined"],                               trend_fields:[] },
  // ACTIVE USERS / talent_activity
  applications:           { stage:"active_users", section:"talent_activity", label:"Applications",           user_type:"talent",  unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.talent_activity"],                       trend_fields:["applications_dod","applications_7d_avg"] },
  apps_per_job:           { stage:"active_users", section:"talent_activity", label:"Apps / Job",             user_type:"talent",  unit:"ratio",      is_higher_better:true,  display_format:"%.1f",    appears_in:["active_users.talent_activity"],                       trend_fields:[] },
  profile_views:          { stage:"active_users", section:"talent_activity", label:"Profile Views",          user_type:"talent",  unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.talent_activity"],                       trend_fields:[] },
  job_views:              { stage:"active_users", section:"talent_activity", label:"Job Views",              user_type:"talent",  unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.talent_activity"],                       trend_fields:[] },
  reviews:                { stage:"active_users", section:"talent_activity", label:"Reviews",                user_type:"both",    unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.talent_activity"],                       trend_fields:[] },
  // ACTIVE USERS / company_activity
  jobs_posted:            { stage:"active_users", section:"company_activity",label:"Jobs Posted",            user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.company_activity"],                      trend_fields:[] },
  hires:                  { stage:"active_users", section:"company_activity",label:"Hires",                  user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.company_activity"],                      trend_fields:[] },
  match_rate_pct:         { stage:"active_users", section:"company_activity",label:"Match Rate",             user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["active_users.company_activity"],                      trend_fields:[] },
  app_to_hire_pct:        { stage:"active_users", section:"company_activity",label:"Apply-to-Hire Rate",     user_type:"both",    unit:"percentage", is_higher_better:true,  display_format:"%.2f%%",  appears_in:["active_users.company_activity"],                      trend_fields:[] },
  // ACTIVE USERS / revenue
  revenue:                { stage:"active_users", section:"revenue",         label:"Revenue",                user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["active_users.revenue"],                               trend_fields:["revenue_dod","revenue_7d_avg","revenue_wow_pct"] },
  stripe_revenue:         { stage:"active_users", section:"revenue",         label:"Stripe Revenue",         user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["active_users.revenue"],                               trend_fields:["stripe_revenue_dod","stripe_revenue_7d_avg","stripe_revenue_wow_pct"] },
  purchases:              { stage:"active_users", section:"revenue",         label:"Purchases",              user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:["purchases_dod","purchases_7d_avg","purchases_wow_pct"] },
  failed_transactions:    { stage:"active_users", section:"revenue",         label:"Failed Transactions",    user_type:"company", unit:"count",      is_higher_better:false, display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  purchasing_customers:   { stage:"active_users", section:"revenue",         label:"Purchasing Customers",   user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  purchases_per_customer_daily:{ stage:"active_users", section:"revenue",   label:"Purchases / Customer",   user_type:"company", unit:"ratio",      is_higher_better:true,  display_format:"%.2f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  avg_purchases_per_company:{ stage:"active_users", section:"revenue",      label:"Avg Purchases / Company",user_type:"company", unit:"ratio",      is_higher_better:true,  display_format:"%.2f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  company_purchase_conversion_pct:{ stage:"active_users", section:"revenue",label:"Company Purchase CVR",   user_type:"company", unit:"percentage", is_higher_better:true,  display_format:"%.1f%%",  appears_in:["active_users.revenue"],                               trend_fields:[] },
  revenue_per_hire:       { stage:"active_users", section:"revenue",         label:"Revenue / Hire",         user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["active_users.revenue"],                               trend_fields:[] },
  cumulative_purchases:   { stage:"active_users", section:"revenue",         label:"Cumulative Purchases",   user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  mrr:                    { stage:"active_users", section:"revenue",         label:"MRR",                    user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["active_users.revenue"],                               trend_fields:[] },
  arr:                    { stage:"active_users", section:"revenue",         label:"ARR",                    user_type:"company", unit:"currency",   is_higher_better:true,  display_format:"$%.0f",   appears_in:["active_users.revenue"],                               trend_fields:[] },
  active_subscriptions:   { stage:"active_users", section:"revenue",         label:"Active Subscriptions",   user_type:"company", unit:"count",      is_higher_better:true,  display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  churned_subscriptions:  { stage:"active_users", section:"revenue",         label:"Churned Subscriptions",  user_type:"company", unit:"count",      is_higher_better:false, display_format:"%.0f",    appears_in:["active_users.revenue"],                               trend_fields:[] },
  churn_rate_pct:         { stage:"active_users", section:"revenue",         label:"Churn Rate",             user_type:"company", unit:"percentage", is_higher_better:false, display_format:"%.2f%%",  appears_in:["active_users.revenue"],                               trend_fields:[] },
};

// Trend field suffixes and their meaning (for AI context)
const TREND_SUFFIX_LABELS: Record<string, string> = {
  "_dod":     "day-over-day delta",
  "_7d_avg":  "7-day rolling average",
  "_wow_pct": "week-over-week % change",
};

type MetricValue = {
  key: string;
  label: string;
  value: unknown;
  unit: string;
  display_format: string;
  is_higher_better: boolean | null;
  user_type: string;
  appears_in: string[];
  trend: Record<string, { value: unknown; meaning: string }>;
};

type StructuredDay = {
  date: string;
  stages: Record<string, Record<string, MetricValue[]>>;
};

/** Transform a flat daily_metrics row into the stage/section/trend structure */
function toStructured(row: Record<string, unknown>): StructuredDay {
  const dateVal = row["date"];
  const date = dateVal && typeof dateVal === "object" && "value" in dateVal
    ? String((dateVal as { value: unknown }).value)
    : String(dateVal ?? "");

  // Collect all trend field values from the row
  const rowTrendValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    for (const suffix of Object.keys(TREND_SUFFIX_LABELS)) {
      if (k.endsWith(suffix)) rowTrendValues[k] = v;
    }
  }

  const stages: Record<string, Record<string, MetricValue[]>> = {};

  for (const [field, def] of Object.entries(METRIC_REGISTRY)) {
    if (!(field in row)) continue;
    const rawVal = row[field];
    const val = rawVal !== null && typeof rawVal === "object" && "value" in rawVal
      ? (rawVal as { value: unknown }).value
      : rawVal;

    // Build trend object
    const trend: Record<string, { value: unknown; meaning: string }> = {};
    for (const trendField of def.trend_fields) {
      if (trendField in rowTrendValues) {
        const tv = rowTrendValues[trendField];
        const tVal = tv !== null && typeof tv === "object" && "value" in tv
          ? (tv as { value: unknown }).value
          : tv;
        // Determine suffix label
        const suffix = Object.keys(TREND_SUFFIX_LABELS).find(s => trendField.endsWith(s)) ?? "";
        trend[trendField] = { value: tVal, meaning: TREND_SUFFIX_LABELS[suffix] ?? suffix };
      }
    }

    // Primary stage/section placement
    const { stage, section } = def;
    if (!stages[stage]) stages[stage] = {};
    if (!stages[stage][section]) stages[stage][section] = [];
    stages[stage][section].push({
      key: field,
      label: def.label,
      value: val,
      unit: def.unit,
      display_format: def.display_format,
      is_higher_better: def.is_higher_better,
      user_type: def.user_type,
      appears_in: def.appears_in,
      trend,
    });
  }

  return { date, stages };
}

/** Returns the ISO Monday date for any given date string */
function getISOWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun
  date.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return date.toISOString().slice(0, 10);
}

/** Returns the first day of the month for any given date string */
function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

/**
 * Aggregates daily_metrics rows into period buckets (week/month).
 * Counts and currency are summed; percentages and ratios are averaged.
 * Trend fields are nulled out — they're not meaningful at coarser grains.
 */
function aggregateDailyRows(
  rows: Record<string, unknown>[],
  periodFn: (date: string) => string
): Record<string, unknown>[] {
  const byPeriod = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const date = String(unwrapCell(row.date) ?? "");
    if (!date) continue;
    const key = periodFn(date);
    const bucket = byPeriod.get(key) ?? [];
    bucket.push(row);
    byPeriod.set(key, bucket);
  }
  return Array.from(byPeriod.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // DESC by period
    .map(([period, bucket]) => {
      const out: Record<string, unknown> = { date: period };
      for (const [field, def] of Object.entries(METRIC_REGISTRY)) {
        const nums = bucket
          .map((r) => unwrapCell(r[field]))
          .filter((v) => v !== null && v !== undefined)
          .map(Number)
          .filter((n) => !Number.isNaN(n));
        out[field] =
          nums.length === 0
            ? null
            : def.unit === "percentage" || def.unit === "ratio"
              ? nums.reduce((a, b) => a + b, 0) / nums.length
              : nums.reduce((a, b) => a + b, 0);
        // trend fields are not meaningful at coarser grain
        for (const tf of def.trend_fields) out[tf] = null;
      }
      return out;
    });
}

/** Hard cap to avoid accidental huge scans; ~7y daily or ~48y weekly */
const MAX_LIMIT = 2500;
const DEFAULT_LIMIT_NO_RANGE = 500;
const DEFAULT_LIMIT_WITH_RANGE = 2000;
/** Analysis pack: return full window (Granger / trends need contiguous series) */
const ANALYSIS_PACK_ROW_CAP = 5000;

export type ReportingGranularity = "daily" | "weekly" | "monthly";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateOnly(s: string | null): s is string {
  return typeof s === "string" && DATE_ONLY.test(s);
}

/** ISO date +/− N calendar days (UTC) */
function addCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** BigQuery sometimes returns { value: x } for cell values */
function unwrapCell(v: unknown): unknown {
  if (v !== null && typeof v === "object" && "value" in v) {
    return (v as { value: unknown }).value;
  }
  return v;
}

function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = unwrapCell(v);
  }
  return out;
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === "number" && !Number.isNaN(v)) return true;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return true;
  return false;
}

/** Metric columns for scripts/metric-driver-explorer (time series CSV / JSON) */
function numericMetricKeysFromRows(rows: Record<string, unknown>[]): string[] {
  const skip = new Set(["date", "week_start", "month_start", "week_num"]);
  const keys = new Set<string>();
  for (const row of rows.slice(0, Math.min(rows.length, 400))) {
    for (const [k, v] of Object.entries(row)) {
      if (skip.has(k) || v === null || v === undefined) continue;
      if (isNumericLike(v)) keys.add(k);
    }
  }
  return Array.from(keys).sort();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const granularity = (searchParams.get("granularity") || "daily") as ReportingGranularity;
  const responseFormat = searchParams.get("format") || "flat"; // "flat" | "structured"
  let startDate = searchParams.get("startDate") || undefined;
  let endDate = searchParams.get("endDate") || undefined;
  const includeAnalysisPack =
    searchParams.get("includeAnalysisPack") === "1" ||
    searchParams.get("includeAnalysisPack") === "true";
  const flattenRows =
    searchParams.get("flattenRows") === "1" ||
    searchParams.get("flattenRows") === "true";

  if (!["daily", "weekly", "monthly"].includes(granularity)) {
    return NextResponse.json({ error: "Invalid granularity; use daily, weekly, or monthly" }, { status: 400 });
  }

  const lookbackRaw = searchParams.get("lookbackDays");
  if (lookbackRaw && /^\d{1,4}$/.test(lookbackRaw)) {
    const lb = parseInt(lookbackRaw, 10);
    if (lb >= 1 && lb <= 1095) {
      if (!endDate) {
        endDate = new Date().toISOString().slice(0, 10);
      }
      if (!startDate && endDate && isValidDateOnly(endDate)) {
        startDate = addCalendarDays(endDate, -(lb - 1));
      }
    }
  }

  const table =
    granularity === "daily"
      ? "daily_metrics"
      : granularity === "weekly"
        ? "weekly_metrics"
        : "monthly_metrics";

  const dateCol =
    granularity === "daily"
      ? "date"
      : granularity === "weekly"
        ? "week_start"
        : "month_start";

  const orderBy = dateCol;
  const seriesOrder =
    searchParams.get("order") === "asc" || searchParams.get("order") === "ASC"
      ? "ASC"
      : "DESC";

  const useRange = Boolean(
    startDate && endDate && isValidDateOnly(startDate) && isValidDateOnly(endDate)
  );
  const whereClause = useRange
    ? `WHERE ${dateCol} >= @startDate AND ${dateCol} <= @endDate`
    : "";

  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  let limit = Number.isFinite(parsedLimit)
    ? parsedLimit
    : useRange
      ? DEFAULT_LIMIT_WITH_RANGE
      : DEFAULT_LIMIT_NO_RANGE;
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentials) {
      return NextResponse.json(
        { error: "BigQuery credentials not configured", rows: [] },
        { status: 200 }
      );
    }

    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: JSON.parse(credentials),
    });

    const query = useRange
      ? {
          query: `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET}.${table}\`
      ${whereClause}
      ORDER BY ${orderBy} ${seriesOrder}
      LIMIT @limit
    `,
          params: { startDate, endDate, limit },
        }
      : {
          query: `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET}.${table}\`
      ORDER BY ${orderBy} ${seriesOrder}
      LIMIT @limit
    `,
          params: { limit },
        };

    const [rows] = await bq.query({ ...query, location: BQ_LOCATION });

    const rowOut =
      flattenRows && rows?.length
        ? (rows as Record<string, unknown>[]).map((r) =>
            flattenRow(r as Record<string, unknown>)
          )
        : rows || [];

    let analysisPack: {
      seriesAsc: Record<string, unknown>[];
      numericMetricKeys: string[];
      source: string;
      note: string;
    } | null = null;

    if (includeAnalysisPack && useRange && startDate && endDate) {
      try {
        if (granularity === "daily") {
          const analysisQuery = {
            query: `
              SELECT
                d.*,
                m.total_attributed_signups AS total_attributed_signups,
                m.ac_marketing_sends,
                m.ac_marketing_opens,
                m.ac_marketing_clicks,
                m.ac_marketing_campaigns_launched,
                m.ac_marketing_open_rate_pct,
                m.ac_marketing_ctr_pct,
                m.ac_automation_sends,
                m.ac_automation_opens,
                m.ac_automation_clicks,
                m.ac_automation_campaigns_launched,
                m.ac_automation_open_rate_pct,
                m.ac_automation_ctr_pct,
                m.ac_total_sends,
                m.ac_total_opens,
                m.ac_total_clicks,
                m.ac_campaigns_sent_count,
                m.ac_blended_open_rate_pct,
                m.ac_blended_ctr_pct,
                m.ac_click_to_open_pct,
                m.ac_activity_opens,
                m.ac_activity_clicks,
                m.ac_activity_unique_openers,
                m.ac_activity_unique_clickers,
                m.ac_list_subscribers_total
              FROM \`${PROJECT_ID}.${DATASET}.daily_metrics\` d
              LEFT JOIN \`${PROJECT_ID}.marketing_ai.v_master_daily_metrics\` m
                ON m.date = d.date
              WHERE d.date >= @startDate AND d.date <= @endDate
              ORDER BY d.date ASC
              LIMIT @analysisLimit
            `,
            params: {
              startDate,
              endDate,
              analysisLimit: ANALYSIS_PACK_ROW_CAP,
            },
            location: BQ_LOCATION,
          };
          const [aRows] = await bq.query(analysisQuery);
          const flat = (aRows || []).map((r) =>
            flattenRow(r as Record<string, unknown>)
          );
          analysisPack = {
            seriesAsc: flat,
            numericMetricKeys: numericMetricKeysFromRows(flat),
            source: `${PROJECT_ID}.${DATASET}.daily_metrics+v_master_daily_metrics`,
            note:
              "Chronological daily rows for metric_driver_explorer.py and lever_priority.py (uses reporting.daily_metrics in BQ; refresh via reporting-table-refresh).",
          };
        } else {
          const analysisQuery = {
            query: `
              SELECT *
              FROM \`${PROJECT_ID}.${DATASET}.${table}\`
              WHERE ${dateCol} >= @startDate AND ${dateCol} <= @endDate
              ORDER BY ${dateCol} ASC
              LIMIT @analysisLimit
            `,
            params: {
              startDate,
              endDate,
              analysisLimit: ANALYSIS_PACK_ROW_CAP,
            },
            location: BQ_LOCATION,
          };
          const [aRows] = await bq.query(analysisQuery);
          const flat = (aRows || []).map((r) =>
            flattenRow(r as Record<string, unknown>)
          );
          analysisPack = {
            seriesAsc: flat,
            numericMetricKeys: numericMetricKeysFromRows(flat),
            source: `${PROJECT_ID}.${DATASET}.${table}`,
            note:
              granularity === "weekly"
                ? "Weekly rollups from reporting.weekly_metrics (SUM counts, AVG of daily rates). Good for trend charts; for Granger / lever_priority use daily with lookbackDays>=90."
                : "Monthly rollups from reporting.monthly_metrics. Use daily series for driver/elasticity models.",
          };
        }
      } catch (ae) {
        console.error("[reporting-metrics] analysisPack error:", ae);
      }
    }

    // Also fetch product breakdown data
    let productData: any[] = [];
    let productDateColumns: string[] = [];
    
    if (useRange && startDate && endDate) {
      try {
        // Build date aggregation and label based on granularity
        let dateSelect: string;
        if (granularity === "weekly") {
          dateSelect = `
            FORMAT_DATE('%G-W%V', DATE_TRUNC(date, WEEK(MONDAY))) as period_label,
            DATE_TRUNC(date, WEEK(MONDAY)) as period_date
          `;
        } else if (granularity === "monthly") {
          dateSelect = `
            FORMAT_DATE('%Y-%m', DATE_TRUNC(date, MONTH)) as period_label,
            DATE_TRUNC(date, MONTH) as period_date
          `;
        } else {
          dateSelect = "date as period_label, date as period_date";
        }
        
        // Build product breakdown from payment_session filtered to PAID ONLY
        // This matches our Stripe revenue definition (succeeded charges only)
        const productQuery = `
          SELECT 
            ${dateSelect},
            COALESCE(JSON_EXTRACT_SCALAR(source_breakdown, '$.product'), 'Unknown') as product,
            SUM(revenue) as revenue,
            COUNT(DISTINCT canonical_entity_id) as purchase_count
          FROM \`${PROJECT_ID}.marketing_ai.daily_entity_metrics\`
          WHERE organization_id = 'ytjobs'
            AND entity_type = 'payment_session'
            AND conversions > 0
            AND JSON_EXTRACT_SCALAR(source_breakdown, '$.payment_status') = 'paid'
            AND date >= @startDate
            AND date <= @endDate
          GROUP BY period_label, period_date, product
          ORDER BY period_date
        `;
        
        const [productRows] = await bq.query({
          query: productQuery,
          params: { startDate, endDate },
          location: BQ_LOCATION,
        });
        
        // Parse product data - now returns one row per product per period
        // Store both label (for display) and date (for sorting)
        const byDate: Record<string, { 
          sortDate: string;
          products: Record<string, { revenue: number; purchases: number }> 
        }> = {};
        
        productRows.forEach((row: any) => {
          try {
            // Extract period label and date
            const labelValue = row.period_label?.value || row.period_label;
            const dateKey = typeof labelValue === 'string' ? labelValue : String(labelValue);
            
            const dateValue = row.period_date?.value || row.period_date;
            const sortDate = typeof dateValue === 'string' ? dateValue : new Date(dateValue).toISOString().slice(0, 10);
            
            if (!byDate[dateKey]) {
              byDate[dateKey] = { sortDate, products: {} };
            }
            
            // Extract product data
            const productName = row.product || 'Unknown';
            const revenue = Number(row.revenue) || 0;
            const purchases = Number(row.purchase_count) || 0;
            
            if (!byDate[dateKey].products[productName]) {
              byDate[dateKey].products[productName] = { revenue: 0, purchases: 0 };
            }
            byDate[dateKey].products[productName].revenue += revenue;
            byDate[dateKey].products[productName].purchases += purchases;
            
          } catch (err) {
            console.error("[reporting-metrics] Error processing product row:", err);
          }
        });
        
        // Transform to product rows
        const allProducts = new Set<string>();
        Object.values(byDate).forEach(dateData => {
          Object.keys(dateData.products).forEach(product => allProducts.add(product));
        });
        
        productData = Array.from(allProducts).map(product => {
          const row: any = { product };
          let totalRevenue = 0;
          let totalPurchases = 0;
          
          Object.keys(byDate).forEach(dateKey => {
            if (byDate[dateKey].products[product]) {
              row[dateKey] = byDate[dateKey].products[product].revenue;
              row[`${dateKey}_purchases`] = byDate[dateKey].products[product].purchases;
              totalRevenue += byDate[dateKey].products[product].revenue;
              totalPurchases += byDate[dateKey].products[product].purchases;
            } else {
              row[dateKey] = 0;
              row[`${dateKey}_purchases`] = 0;
            }
          });
          
          row.totalRevenue = totalRevenue;
          row.totalPurchases = totalPurchases;
          return row;
        });
        
        productData.sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        // Sort date columns by actual date, not by display label
        productDateColumns = Object.keys(byDate).sort((a, b) => {
          const dateA = byDate[a].sortDate;
          const dateB = byDate[b].sortDate;
          return dateA.localeCompare(dateB); // Chronological sort by actual date
        });
      } catch (productErr) {
        console.error("[reporting-metrics] Product data error:", productErr);
      }
    }
    
    // Structured format: group metrics by stage/section with trend embedded
    if (responseFormat === "structured") {
      let structuredRows: StructuredDay[];

      if (granularity === "daily") {
        structuredRows = (rowOut as Record<string, unknown>[]).map(toStructured);
      } else {
        // For weekly/monthly: re-fetch from daily_metrics and aggregate on the fly.
        // This gives the same 96-metric schema at all granularities.
        const daysPerPeriod = granularity === "weekly" ? 8 : 35;
        const dailyLimit = Math.min(limit * daysPerPeriod, 2500);
        const dailyQ = useRange
          ? {
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET}.daily_metrics\` WHERE date >= @startDate AND date <= @endDate ORDER BY date ASC LIMIT @dailyLimit`,
              params: { startDate, endDate, dailyLimit },
            }
          : {
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET}.daily_metrics\` ORDER BY date DESC LIMIT @dailyLimit`,
              params: { dailyLimit },
            };
        const [dailyRaw] = await bq.query({ ...dailyQ, location: BQ_LOCATION });
        const flatDaily = (dailyRaw || []).map((r) =>
          flattenRow(r as Record<string, unknown>)
        );
        const periodFn = granularity === "weekly" ? getISOWeekStart : getMonthStart;
        const aggregated = aggregateDailyRows(flatDaily, periodFn);
        structuredRows = aggregated.map(toStructured);
      }

      return NextResponse.json({
        format: "structured",
        granularity,
        rows: structuredRows,
        schema: {
          stages: ["acquisition", "onboarding", "active_users"],
          sections: {
            acquisition: ["paid_ads", "traffic", "email"],
            onboarding:  ["talent", "company", "combined"],
            active_users: ["talent_activity", "company_activity", "revenue"],
          },
          user_types: ["both", "talent", "company"],
          trend_suffixes: TREND_SUFFIX_LABELS,
          metric_count: Object.keys(METRIC_REGISTRY).length,
          ...(granularity !== "daily" && {
            aggregation_note: "counts/currency = SUM across days in period; percentages/ratios = AVG. Trend fields are null at weekly/monthly grain.",
          }),
        },
        meta: {
          startDate: useRange ? startDate : null,
          endDate: useRange ? endDate : null,
          order: seriesOrder.toLowerCase(),
          limit,
          note: granularity === "daily"
            ? "Each metric has value + trend{dod, 7d_avg, wow_pct} inline. Use appears_in[] to find cross-stage metrics. Filter by user_type to scope to talent or company view."
            : `${granularity === "weekly" ? "Weekly" : "Monthly"} aggregation of daily_metrics. Counts/currency summed; rates/percentages averaged across days in the period. Trend fields are null.`,
        },
      });
    }

    return NextResponse.json({
      rows: rowOut,
      granularity,
      products: productData,
      productDateColumns,
      meta: {
        startDate: useRange ? startDate : null,
        endDate: useRange ? endDate : null,
        order: seriesOrder.toLowerCase(),
        limit,
        maxLimit: MAX_LIMIT,
        flattenRows,
        lookbackDays: lookbackRaw && /^\d{1,4}$/.test(lookbackRaw) ? lookbackRaw : null,
        includeAnalysisPack,
        analysisPackRowCap: ANALYSIS_PACK_ROW_CAP,
        trendHints: {
          grangerOrDriversDailyMinDays: 90,
          weeklyRollupMinWeeks: 12,
          exampleDaily:
            "?granularity=daily&lookbackDays=400&order=asc&includeAnalysisPack=1&flattenRows=1",
          exampleWeekly:
            "?granularity=weekly&lookbackDays=728&order=asc&includeAnalysisPack=1&flattenRows=1",
        },
      },
      ...(analysisPack ? { analysisPack } : {}),
    });
  } catch (err) {
    console.error("[reporting-metrics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BigQuery error", rows: [] },
      { status: 500 }
    );
  }
}

// Helper to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
