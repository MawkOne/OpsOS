import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

// POST - Create user document in Firestore
export async function POST(request: NextRequest) {
  try {
    const { userId, email, displayName } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "User ID and email are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return NextResponse.json({
        success: true,
        message: "User already exists",
      });
    }

    // Create user document
    await setDoc(userDocRef, {
      email: email.toLowerCase(),
      displayName: displayName || email.split("@")[0],
      createdAt: Timestamp.now(),
      organizationIds: [],
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
