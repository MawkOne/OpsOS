import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const connectionRef = doc(db, "dataforseo_connections", organizationId);
    await updateDoc(connectionRef, {
      status: "disconnected",
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: "DataForSEO disconnected successfully",
    });
  } catch (error) {
    console.error("DataForSEO disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect DataForSEO" },
      { status: 500 }
    );
  }
}

