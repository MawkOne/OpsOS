import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
// Uses Application Default Credentials (ADC) from Firebase/GCP
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'opsos-864a1',
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
  }

  try {
    // Get all datasets in the project
    const [datasets] = await bigquery.getDatasets();
    
    // Filter for GA4 datasets (they start with 'analytics_')
    const ga4Datasets = [];

    for (const dataset of datasets) {
      const datasetId = dataset.id;
      
      if (!datasetId?.startsWith('analytics_')) {
        continue;
      }

      // Get tables in this dataset
      const [tables] = await dataset.getTables();
      
      // Find event tables (format: events_YYYYMMDD)
      const eventTables = tables
        .filter(t => t.id?.startsWith('events_') && t.id.length === 15)
        .map(t => t.id!)
        .sort();

      if (eventTables.length === 0) {
        continue;
      }

      // Get date range from table names
      const dates = eventTables.map(t => t.replace('events_', ''));
      const earliestDate = dates[0];
      const latestDate = dates[dates.length - 1];

      // Format dates nicely
      const formatDate = (d: string) => 
        `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;

      // Estimate total events (rough estimate based on typical GA4 data)
      // This is just for display - actual counts would require expensive queries
      const estimatedEventsPerDay = 5000; // Adjust based on your typical volume
      const estimatedEvents = eventTables.length * estimatedEventsPerDay;

      ga4Datasets.push({
        datasetId,
        tables: eventTables,
        earliestDate: formatDate(earliestDate),
        latestDate: formatDate(latestDate),
        estimatedEvents,
        tableCount: eventTables.length,
      });
    }

    if (ga4Datasets.length === 0) {
      return NextResponse.json({
        datasets: [],
        message: 'No GA4 datasets found. Make sure GA4 BigQuery export is enabled.',
      });
    }

    return NextResponse.json({
      datasets: ga4Datasets,
      projectId: bigquery.projectId,
    });

  } catch (error) {
    console.error('Error discovering BigQuery datasets:', error);
    
    // Check for common errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('permission') || errorMessage.includes('403')) {
      return NextResponse.json({
        error: 'Permission denied. Make sure the service account has BigQuery access.',
        details: errorMessage,
      }, { status: 403 });
    }

    if (errorMessage.includes('Could not load the default credentials')) {
      return NextResponse.json({
        error: 'BigQuery credentials not configured. Set up Application Default Credentials.',
        details: errorMessage,
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Failed to discover BigQuery datasets',
      details: errorMessage,
    }, { status: 500 });
  }
}
