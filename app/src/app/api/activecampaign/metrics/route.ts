import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Get contacts count
    const contactsQuery = query(
      collection(db, 'activecampaign_contacts'),
      where('organizationId', '==', organizationId)
    );
    const contactsSnapshot = await getDocs(contactsQuery);
    const totalContacts = contactsSnapshot.size;
    
    let activeContacts = 0;
    contactsSnapshot.forEach((doc) => {
      const contact = doc.data();
      if (contact.status === 1) activeContacts++;
    });

    // Get deals
    const dealsQuery = query(
      collection(db, 'activecampaign_deals'),
      where('organizationId', '==', organizationId)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    
    let totalDeals = 0;
    let openDeals = 0;
    let wonDeals = 0;
    let lostDeals = 0;
    let pipelineValue = 0;
    let wonValue = 0;
    
    dealsSnapshot.forEach((doc) => {
      const deal = doc.data();
      totalDeals++;
      const value = (deal.value || 0) / 100; // Convert from cents
      
      if (deal.status === 0) {
        openDeals++;
        pipelineValue += value;
      } else if (deal.status === 1) {
        wonDeals++;
        wonValue += value;
      } else if (deal.status === 2) {
        lostDeals++;
      }
    });

    // Get campaigns
    const campaignsQuery = query(
      collection(db, 'activecampaign_campaigns'),
      where('organizationId', '==', organizationId)
    );
    const campaignsSnapshot = await getDocs(campaignsQuery);
    
    let totalCampaigns = 0;
    let totalSent = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    
    campaignsSnapshot.forEach((doc) => {
      const campaign = doc.data();
      totalCampaigns++;
      totalSent += campaign.sendAmt || 0;
      totalOpens += campaign.uniqueOpens || 0;
      totalClicks += campaign.uniqueLinkClicks || 0;
    });

    const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

    // Get automations
    const automationsQuery = query(
      collection(db, 'activecampaign_automations'),
      where('organizationId', '==', organizationId)
    );
    const automationsSnapshot = await getDocs(automationsQuery);
    
    let activeAutomations = 0;
    let totalEntered = 0;
    
    automationsSnapshot.forEach((doc) => {
      const automation = doc.data();
      if (automation.status === 1) activeAutomations++;
      totalEntered += automation.entered || 0;
    });

    // Get lists
    const listsQuery = query(
      collection(db, 'activecampaign_lists'),
      where('organizationId', '==', organizationId)
    );
    const listsSnapshot = await getDocs(listsQuery);
    
    let totalSubscribers = 0;
    
    listsSnapshot.forEach((doc) => {
      const list = doc.data();
      totalSubscribers += list.subscriberCount || 0;
    });

    return NextResponse.json({
      contacts: {
        total: totalContacts,
        active: activeContacts,
      },
      deals: {
        total: totalDeals,
        open: openDeals,
        won: wonDeals,
        lost: lostDeals,
        pipelineValue,
        wonValue,
        winRate: totalDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0,
      },
      campaigns: {
        total: totalCampaigns,
        totalSent,
        openRate,
        clickRate,
      },
      automations: {
        active: activeAutomations,
        totalEntered,
      },
      subscribers: totalSubscribers,
    });
  } catch (error) {
    console.error('ActiveCampaign metrics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

