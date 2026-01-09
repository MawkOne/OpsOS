import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, login, password, domain } = await request.json();

    if (!organizationId || !login || !password || !domain) {
      return NextResponse.json(
        { error: "Organization ID, login, password, and domain are required" },
        { status: 400 }
      );
    }

    // Verify credentials by making a test API call
    const credentials = Buffer.from(`${login}:${password}`).toString("base64");
    
    const testResponse = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      return NextResponse.json(
        { error: errorData.status_message || "Invalid DataForSEO credentials" },
        { status: 401 }
      );
    }

    const userData = await testResponse.json();
    
    // Store the connection in Firestore
    const connectionRef = doc(db, "dataforseo_connections", organizationId);
    await setDoc(connectionRef, {
      organizationId,
      login,
      password, // In production, this should be encrypted
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), // Clean domain
      status: "connected",
      balance: userData.tasks?.[0]?.result?.[0]?.money?.balance || 0,
      connectedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: "DataForSEO connected successfully",
      balance: userData.tasks?.[0]?.result?.[0]?.money?.balance || 0,
    });
  } catch (error) {
    console.error("DataForSEO connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect to DataForSEO" },
      { status: 500 }
    );
  }
}

