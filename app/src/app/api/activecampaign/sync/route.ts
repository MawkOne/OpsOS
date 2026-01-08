import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';

interface ActiveCampaignConnection {
  status: string;
  apiUrl: string;
  apiKey: string;
  accountName: string;
}

// Make authenticated ActiveCampaign API request
async function acRequest(
  apiUrl: string,
  apiKey: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<Response> {
  const url = new URL(`${apiUrl}/api/3/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return fetch(url.toString(), {
    headers: {
      'Api-Token': apiKey,
      'Accept': 'application/json',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Get connection from Firestore
    const connectionRef = doc(db, 'activecampaign_connections', organizationId);
    const connectionSnap = await getDoc(connectionRef);

    if (!connectionSnap.exists()) {
      return NextResponse.json({ error: 'ActiveCampaign not connected' }, { status: 400 });
    }

    const connection = connectionSnap.data() as ActiveCampaignConnection;

    if (connection.status !== 'connected') {
      return NextResponse.json({ error: 'ActiveCampaign connection invalid' }, { status: 400 });
    }

    // Update status to syncing
    await updateDoc(connectionRef, { status: 'syncing', updatedAt: serverTimestamp() });

    const { apiUrl, apiKey } = connection;

    const results = {
      contacts: 0,
      deals: 0,
      pipelines: 0,
      campaigns: 0,
      automations: 0,
      lists: 0,
      errors: [] as string[],
    };

    // Sync Contacts
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const contactsResponse = await acRequest(apiUrl, apiKey, 'contacts', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (contactsResponse.ok) {
          const data = await contactsResponse.json();
          const contacts = data.contacts || [];

          for (const contact of contacts) {
            const contactRef = doc(collection(db, 'activecampaign_contacts'), `${organizationId}_${contact.id}`);
            await setDoc(contactRef, {
              organizationId,
              activecampaignId: contact.id,
              email: contact.email || '',
              firstName: contact.firstName || '',
              lastName: contact.lastName || '',
              phone: contact.phone || '',
              score: contact.score_values?.[0]?.score || 0,
              status: contact.status || 0, // -1=unconfirmed, 0=inactive, 1=active, 2=bounced
              createdAt: contact.cdate ? Timestamp.fromDate(new Date(contact.cdate)) : null,
              updatedAt: contact.udate ? Timestamp.fromDate(new Date(contact.udate)) : null,
              syncedAt: serverTimestamp(),
            });
            results.contacts++;
          }

          hasMore = contacts.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Contacts sync failed: ${error}`);
    }

    // Sync Pipelines (Deal Groups)
    try {
      const pipelinesResponse = await acRequest(apiUrl, apiKey, 'dealGroups');
      if (pipelinesResponse.ok) {
        const data = await pipelinesResponse.json();
        const pipelines = data.dealGroups || [];

        for (const pipeline of pipelines) {
          const pipelineRef = doc(collection(db, 'activecampaign_pipelines'), `${organizationId}_${pipeline.id}`);
          await setDoc(pipelineRef, {
            organizationId,
            activecampaignId: pipeline.id,
            title: pipeline.title || '',
            currency: pipeline.currency || 'USD',
            stageCount: pipeline.stages?.length || 0,
            syncedAt: serverTimestamp(),
          });
          results.pipelines++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Pipelines sync failed: ${error}`);
    }

    // Sync Deals
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const dealsResponse = await acRequest(apiUrl, apiKey, 'deals', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (dealsResponse.ok) {
          const data = await dealsResponse.json();
          const deals = data.deals || [];

          for (const deal of deals) {
            const dealRef = doc(collection(db, 'activecampaign_deals'), `${organizationId}_${deal.id}`);
            await setDoc(dealRef, {
              organizationId,
              activecampaignId: deal.id,
              title: deal.title || '',
              description: deal.description || '',
              value: parseInt(deal.value) || 0, // Value in cents
              currency: deal.currency || 'usd',
              status: parseInt(deal.status) || 0, // 0=open, 1=won, 2=lost
              pipelineId: deal.group || null,
              stageId: deal.stage || null,
              contactId: deal.contact || null,
              ownerId: deal.owner || null,
              percent: parseInt(deal.percent) || 0,
              createdAt: deal.cdate ? Timestamp.fromDate(new Date(deal.cdate)) : null,
              updatedAt: deal.mdate ? Timestamp.fromDate(new Date(deal.mdate)) : null,
              syncedAt: serverTimestamp(),
            });
            results.deals++;
          }

          hasMore = deals.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Deals sync failed: ${error}`);
    }

    // Sync Campaigns
    try {
      const campaignsResponse = await acRequest(apiUrl, apiKey, 'campaigns', {
        limit: '100',
      });

      if (campaignsResponse.ok) {
        const data = await campaignsResponse.json();
        const campaigns = data.campaigns || [];

        for (const campaign of campaigns) {
          const campaignRef = doc(collection(db, 'activecampaign_campaigns'), `${organizationId}_${campaign.id}`);
          await setDoc(campaignRef, {
            organizationId,
            activecampaignId: campaign.id,
            name: campaign.name || '',
            type: campaign.type || '',
            status: parseInt(campaign.status) || 0,
            sendAmt: parseInt(campaign.send_amt) || 0,
            totalAmt: parseInt(campaign.total_amt) || 0,
            opens: parseInt(campaign.opens) || 0,
            uniqueOpens: parseInt(campaign.uniqueopens) || 0,
            linkClicks: parseInt(campaign.linkclicks) || 0,
            uniqueLinkClicks: parseInt(campaign.uniquelinkclicks) || 0,
            unsubscribes: parseInt(campaign.unsubscribes) || 0,
            bounces: parseInt(campaign.hardbounces) + parseInt(campaign.softbounces) || 0,
            createdAt: campaign.cdate ? Timestamp.fromDate(new Date(campaign.cdate)) : null,
            sentAt: campaign.sdate ? Timestamp.fromDate(new Date(campaign.sdate)) : null,
            syncedAt: serverTimestamp(),
          });
          results.campaigns++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Campaigns sync failed: ${error}`);
    }

    // Sync Automations
    try {
      const automationsResponse = await acRequest(apiUrl, apiKey, 'automations', {
        limit: '100',
      });

      if (automationsResponse.ok) {
        const data = await automationsResponse.json();
        const automations = data.automations || [];

        for (const automation of automations) {
          const automationRef = doc(collection(db, 'activecampaign_automations'), `${organizationId}_${automation.id}`);
          await setDoc(automationRef, {
            organizationId,
            activecampaignId: automation.id,
            name: automation.name || '',
            status: parseInt(automation.status) || 0, // 0=inactive, 1=active
            entered: parseInt(automation.entered) || 0,
            exited: parseInt(automation.exited) || 0,
            createdAt: automation.cdate ? Timestamp.fromDate(new Date(automation.cdate)) : null,
            updatedAt: automation.mdate ? Timestamp.fromDate(new Date(automation.mdate)) : null,
            syncedAt: serverTimestamp(),
          });
          results.automations++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Automations sync failed: ${error}`);
    }

    // Sync Lists
    try {
      const listsResponse = await acRequest(apiUrl, apiKey, 'lists', {
        limit: '100',
      });

      if (listsResponse.ok) {
        const data = await listsResponse.json();
        const lists = data.lists || [];

        for (const list of lists) {
          const listRef = doc(collection(db, 'activecampaign_lists'), `${organizationId}_${list.id}`);
          await setDoc(listRef, {
            organizationId,
            activecampaignId: list.id,
            name: list.name || '',
            subscriberCount: parseInt(list.subscriber_count) || 0,
            unsubscribeCount: parseInt(list.unsubscribed_count) || 0,
            createdAt: list.cdate ? Timestamp.fromDate(new Date(list.cdate)) : null,
            updatedAt: list.udate ? Timestamp.fromDate(new Date(list.udate)) : null,
            syncedAt: serverTimestamp(),
          });
          results.lists++;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Lists sync failed: ${error}`);
    }

    // Update connection with sync results
    await updateDoc(connectionRef, {
      status: 'connected',
      lastSyncAt: serverTimestamp(),
      lastSyncResults: results,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('ActiveCampaign sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

