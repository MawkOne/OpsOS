import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore';

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
    const { organizationId, skipContacts = false } = body;

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

    // Allow sync if connected or if stuck in syncing state
    if (connection.status !== 'connected' && connection.status !== 'syncing') {
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
      totalContacts: 0,
      errors: [] as string[],
    };

    // Get total contacts count from API and store it with date
    try {
      // ActiveCampaign returns total in meta when fetching contacts
      const countResponse = await acRequest(apiUrl, apiKey, 'contacts', { limit: '1' });
      if (countResponse.ok) {
        const data = await countResponse.json();
        const totalContacts = parseInt(data.meta?.total) || 0;
        results.totalContacts = totalContacts;
        
        // Store daily contact count
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        const countRef = doc(db, 'activecampaign_contact_counts', `${organizationId}_${dateKey}`);
        await setDoc(countRef, {
          organizationId,
          date: dateKey,
          count: totalContacts,
          timestamp: serverTimestamp(),
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Contact count fetch failed: ${error}`);
    }

    // Sync Contacts (with batching for performance)
    // Note: For very large contact lists, we limit to avoid Vercel timeout
    // Vercel Hobby: 10s, Pro: 60s - keep this low
    const MAX_CONTACTS = 500; // Limit to avoid timeout - sync contacts separately if needed
    if (!skipContacts) try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let batchDocs: { ref: any; data: any }[] = [];

      while (hasMore && results.contacts < MAX_CONTACTS) {
        const contactsResponse = await acRequest(apiUrl, apiKey, 'contacts', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (contactsResponse.ok) {
          const text = await contactsResponse.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            results.errors.push(`Contacts API returned invalid JSON: ${text.substring(0, 100)}`);
            break;
          }
          const contacts = data.contacts || [];

          for (const contact of contacts) {
            if (results.contacts >= MAX_CONTACTS) break;
            
            const contactRef = doc(collection(db, 'activecampaign_contacts'), `${organizationId}_${contact.id}`);
            batchDocs.push({
              ref: contactRef,
              data: {
                organizationId,
                activecampaignId: contact.id,
                email: contact.email || '',
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                phone: contact.phone || '',
                score: contact.score_values?.[0]?.score || 0,
                status: contact.status || 0,
                createdAt: contact.cdate ? Timestamp.fromDate(new Date(contact.cdate)) : null,
                updatedAt: contact.udate ? Timestamp.fromDate(new Date(contact.udate)) : null,
                syncedAt: serverTimestamp(),
              }
            });
            results.contacts++;

            // Commit batch every 500 docs (Firestore limit)
            if (batchDocs.length >= 500) {
              const batch = writeBatch(db);
              batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
              await batch.commit();
              batchDocs = [];
            }
          }

          hasMore = contacts.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }

      // Commit remaining docs
      if (batchDocs.length > 0) {
        const batch = writeBatch(db);
        batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
        await batch.commit();
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Contacts sync failed: ${error}`);
    }

    // Sync Pipelines (Deal Groups)
    try {
      const pipelinesResponse = await acRequest(apiUrl, apiKey, 'dealGroups');
      if (pipelinesResponse.ok) {
        const text = await pipelinesResponse.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          results.errors.push(`Pipelines API returned invalid JSON`);
          throw new Error('Invalid JSON');
        }
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

    // Sync Deals (with batching)
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let batchDocs: { ref: any; data: any }[] = [];

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
            batchDocs.push({
              ref: dealRef,
              data: {
                organizationId,
                activecampaignId: deal.id,
                title: deal.title || '',
                description: deal.description || '',
                value: parseInt(deal.value) || 0,
                currency: deal.currency || 'usd',
                status: parseInt(deal.status) || 0,
                pipelineId: deal.group || null,
                stageId: deal.stage || null,
                contactId: deal.contact || null,
                ownerId: deal.owner || null,
                percent: parseInt(deal.percent) || 0,
                createdAt: deal.cdate ? Timestamp.fromDate(new Date(deal.cdate)) : null,
                updatedAt: deal.mdate ? Timestamp.fromDate(new Date(deal.mdate)) : null,
                syncedAt: serverTimestamp(),
              }
            });
            results.deals++;

            if (batchDocs.length >= 500) {
              const batch = writeBatch(db);
              batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
              await batch.commit();
              batchDocs = [];
            }
          }

          hasMore = deals.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }

      if (batchDocs.length > 0) {
        const batch = writeBatch(db);
        batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
        await batch.commit();
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Deals sync failed: ${error}`);
    }

    // Sync Campaigns (with pagination)
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let batchDocs: { ref: any; data: any }[] = [];

      while (hasMore) {
        const campaignsResponse = await acRequest(apiUrl, apiKey, 'campaigns', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (campaignsResponse.ok) {
          const data = await campaignsResponse.json();
          const campaigns = data.campaigns || [];

          for (const campaign of campaigns) {
            const campaignRef = doc(collection(db, 'activecampaign_campaigns'), `${organizationId}_${campaign.id}`);
            batchDocs.push({
              ref: campaignRef,
              data: {
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
                bounces: (parseInt(campaign.hardbounces) || 0) + (parseInt(campaign.softbounces) || 0),
                createdAt: campaign.cdate ? Timestamp.fromDate(new Date(campaign.cdate)) : null,
                sentAt: campaign.sdate ? Timestamp.fromDate(new Date(campaign.sdate)) : null,
                syncedAt: serverTimestamp(),
              }
            });
            results.campaigns++;

            if (batchDocs.length >= 500) {
              const batch = writeBatch(db);
              batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
              await batch.commit();
              batchDocs = [];
            }
          }

          hasMore = campaigns.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }

      if (batchDocs.length > 0) {
        const batch = writeBatch(db);
        batchDocs.forEach(({ ref, data }) => batch.set(ref, data));
        await batch.commit();
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Campaigns sync failed: ${error}`);
    }

    // Sync Automations (with pagination)
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const automationsResponse = await acRequest(apiUrl, apiKey, 'automations', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (automationsResponse.ok) {
          const data = await automationsResponse.json();
          const automations = data.automations || [];
          const batch = writeBatch(db);

          for (const automation of automations) {
            const automationRef = doc(collection(db, 'activecampaign_automations'), `${organizationId}_${automation.id}`);
            batch.set(automationRef, {
              organizationId,
              activecampaignId: automation.id,
              name: automation.name || '',
              status: parseInt(automation.status) || 0,
              entered: parseInt(automation.entered) || 0,
              exited: parseInt(automation.exited) || 0,
              createdAt: automation.cdate ? Timestamp.fromDate(new Date(automation.cdate)) : null,
              updatedAt: automation.mdate ? Timestamp.fromDate(new Date(automation.mdate)) : null,
              syncedAt: serverTimestamp(),
            });
            results.automations++;
          }

          await batch.commit();
          hasMore = automations.length === limit;
          offset += limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Automations sync failed: ${error}`);
    }

    // Sync Lists (with pagination)
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const listsResponse = await acRequest(apiUrl, apiKey, 'lists', {
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (listsResponse.ok) {
          const data = await listsResponse.json();
          const lists = data.lists || [];
          const batch = writeBatch(db);

          for (const list of lists) {
            const listRef = doc(collection(db, 'activecampaign_lists'), `${organizationId}_${list.id}`);
            batch.set(listRef, {
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

          await batch.commit();
          hasMore = lists.length === limit;
          offset += limit;
        } else {
          hasMore = false;
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
    
    // Try to reset status to connected even on error
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body.organizationId) {
        const connectionRef = doc(db, 'activecampaign_connections', body.organizationId);
        await updateDoc(connectionRef, {
          status: 'connected',
          updatedAt: serverTimestamp(),
          errorMessage: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    } catch {
      // Ignore cleanup errors
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

