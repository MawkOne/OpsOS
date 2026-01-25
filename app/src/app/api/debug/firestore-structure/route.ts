import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Debug API to check Firestore collection structure
 * GET /api/debug/firestore-structure?collection=ga_pages&organizationId=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const collectionName = searchParams.get('collection');

  if (!organizationId || !collectionName) {
    return NextResponse.json(
      { error: 'Missing organizationId or collection' },
      { status: 400 }
    );
  }

  try {
    const q = query(
      collection(db, collectionName),
      where('organizationId', '==', organizationId),
      limit(3)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return NextResponse.json({
        collection: collectionName,
        count: 0,
        message: 'Collection is empty or organizationId not found',
        samples: []
      });
    }

    const samples = snapshot.docs.map(doc => {
      const data = doc.data();
      const fields = Object.keys(data);
      
      // Find time-related fields
      const timeFields = fields.filter(f => 
        ['date', 'month', 'year', 'time', 'created', 'updated', 'sent', 'send'].some(t => f.toLowerCase().includes(t))
      );
      
      return {
        id: doc.id,
        fields: fields,
        timeFields: timeFields,
        timeFieldValues: timeFields.reduce((acc, field) => {
          acc[field] = {
            value: data[field],
            type: typeof data[field]
          };
          return acc;
        }, {} as Record<string, any>),
        sampleData: {
          // Show key fields based on collection type
          ...(data.pagePath && { pagePath: data.pagePath }),
          ...(data.pageTitle && { pageTitle: data.pageTitle }),
          ...(data.campaignName && { campaignName: data.campaignName }),
          ...(data.keyword && { keyword: data.keyword }),
          ...(data.name && { name: data.name }),
          ...(data.sessions && { sessions: data.sessions }),
          ...(data.pageviews && { pageviews: data.pageviews }),
          ...(data.conversions && { conversions: data.conversions }),
          ...(data.revenue && { revenue: data.revenue }),
          ...(data.cost && { cost: data.cost }),
        }
      };
    });

    return NextResponse.json({
      collection: collectionName,
      count: snapshot.size,
      samples,
      analysis: {
        hasMonthField: samples.some(s => s.fields.includes('month')),
        hasYearField: samples.some(s => s.fields.includes('year')),
        hasDateField: samples.some(s => s.timeFields.length > 0),
        commonFields: samples.length > 0 ? samples[0].fields : []
      }
    });

  } catch (error) {
    console.error('Error checking Firestore structure:', error);
    return NextResponse.json(
      { error: 'Failed to check collection structure', details: String(error) },
      { status: 500 }
    );
  }
}
