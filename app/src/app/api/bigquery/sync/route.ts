import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'opsos-864a1',
});

interface SyncConfig {
  startDate: string;
  endDate: string;
  eventTypes: string[];
  excludeEvents: string[];
  sampleRate: number;
  maxEventsPerDay: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, datasetId, config } = body as {
    organizationId: string;
    datasetId: string;
    config: SyncConfig;
  };

  if (!organizationId || !datasetId) {
    return NextResponse.json(
      { error: 'Missing organizationId or datasetId' },
      { status: 400 }
    );
  }

  try {
    // Update connection status to syncing
    const connectionRef = doc(db, 'bigquery_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'syncing',
      ga4DatasetId: datasetId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Convert dates to BigQuery format (YYYYMMDD)
    const startDateBQ = config.startDate.replace(/-/g, '');
    const endDateBQ = config.endDate.replace(/-/g, '');

    // Build the query
    let query = `
      SELECT
        event_date,
        event_timestamp,
        event_name,
        user_pseudo_id,
        user_id,
        device.category as device_category,
        device.operating_system as device_os,
        device.browser as device_browser,
        geo.country as geo_country,
        geo.city as geo_city,
        traffic_source.source as traffic_source,
        traffic_source.medium as traffic_medium,
        traffic_source.name as traffic_campaign,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_location,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') as page_title,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer') as page_referrer,
        (SELECT COALESCE(value.int_value, CAST(value.double_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') as engagement_time_msec,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_engaged') as session_engaged,
        ecommerce.purchase_revenue as purchase_revenue,
        ecommerce.transaction_id as transaction_id
      FROM \`${bigquery.projectId}.${datasetId}.events_*\`
      WHERE _TABLE_SUFFIX BETWEEN '${startDateBQ}' AND '${endDateBQ}'
    `;

    // Add event type filters
    if (config.eventTypes && config.eventTypes.length > 0) {
      const eventList = config.eventTypes.map(e => `'${e}'`).join(', ');
      query += ` AND event_name IN (${eventList})`;
    }

    // Add exclusion filters
    if (config.excludeEvents && config.excludeEvents.length > 0) {
      const excludeList = config.excludeEvents.map(e => `'${e}'`).join(', ');
      query += ` AND event_name NOT IN (${excludeList})`;
    }

    // Add sampling if less than 100%
    if (config.sampleRate && config.sampleRate < 100) {
      query += ` AND RAND() < ${config.sampleRate / 100}`;
    }

    // Add limit per day if specified
    if (config.maxEventsPerDay && config.maxEventsPerDay > 0) {
      // Use a window function to limit per day
      query = `
        WITH ranked_events AS (
          ${query},
          ROW_NUMBER() OVER (PARTITION BY event_date ORDER BY event_timestamp) as row_num
        )
        SELECT * EXCEPT(row_num)
        FROM ranked_events
        WHERE row_num <= ${config.maxEventsPerDay}
      `;
    }

    query += ' ORDER BY event_timestamp';

    console.log('Executing BigQuery query for dataset:', datasetId);

    // Execute query
    const [rows] = await bigquery.query({ query });

    console.log(`Retrieved ${rows.length} events from BigQuery`);

    // Store results in Firestore in batches
    const BATCH_SIZE = 500;
    let eventsIngested = 0;
    const uniqueUsers = new Set<string>();
    const processedDates = new Set<string>();
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const row of batchRows) {
        try {
          const eventId = `${row.user_pseudo_id}_${row.event_timestamp}_${row.event_name}`;
          const eventRef = doc(collection(db, 'bq_events'), `${organizationId}_${eventId}`);

          // Track unique users and dates
          if (row.user_pseudo_id) {
            uniqueUsers.add(row.user_pseudo_id);
          }
          if (row.event_date) {
            processedDates.add(row.event_date);
          }

          batch.set(eventRef, {
            organizationId,
            eventDate: row.event_date,
            eventTimestamp: row.event_timestamp?.value || row.event_timestamp,
            eventName: row.event_name,
            userPseudoId: row.user_pseudo_id,
            userId: row.user_id || null,
            device: {
              category: row.device_category,
              os: row.device_os,
              browser: row.device_browser,
            },
            geo: {
              country: row.geo_country,
              city: row.geo_city,
            },
            trafficSource: {
              source: row.traffic_source,
              medium: row.traffic_medium,
              campaign: row.traffic_campaign,
            },
            page: {
              location: row.page_location,
              title: row.page_title,
              referrer: row.page_referrer,
            },
            engagement: {
              timeMsec: row.engagement_time_msec,
              sessionEngaged: row.session_engaged,
            },
            ecommerce: row.purchase_revenue ? {
              purchaseRevenue: row.purchase_revenue,
              transactionId: row.transaction_id,
            } : null,
            importedAt: serverTimestamp(),
          });

          eventsIngested++;
        } catch (err) {
          errors.push(`Event error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      try {
        await batch.commit();
      } catch (batchError) {
        console.error('Batch commit error:', batchError);
        errors.push(`Batch error: ${batchError instanceof Error ? batchError.message : 'Unknown'}`);
      }
    }

    // Update connection status
    await setDoc(connectionRef, {
      status: 'connected',
      ga4DatasetId: datasetId,
      syncedDateRange: {
        startDate: config.startDate,
        endDate: config.endDate,
      },
      lastSyncAt: serverTimestamp(),
      lastSyncResults: {
        eventsIngested,
        usersIngested: uniqueUsers.size,
        tablesProcessed: processedDates.size,
        errors: errors.slice(0, 10), // Keep only first 10 errors
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      eventsIngested,
      usersIngested: uniqueUsers.size,
      tablesProcessed: processedDates.size,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });

  } catch (error) {
    console.error('BigQuery sync error:', error);

    // Update connection status to error
    const connectionRef = doc(db, 'bigquery_connections', organizationId);
    await setDoc(connectionRef, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      error: 'Failed to sync BigQuery data',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
