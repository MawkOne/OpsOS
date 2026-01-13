import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // Format: YYYY-MM-DD or "latest"
    
    // If no date or "latest", fetch current rates
    if (!date || date === "latest") {
      try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        
        if (!response.ok) {
          throw new Error("Failed to fetch latest rates");
        }

        const data = await response.json();
        
        return NextResponse.json({
          rates: { USD: 1, CAD: data.rates?.CAD || 1.35 },
          date: new Date().toISOString().split('T')[0],
          fallback: false,
        });
      } catch (error) {
        console.error("Error fetching latest rates:", error);
        return NextResponse.json({
          rates: { USD: 1, CAD: 1.35 },
          fallback: true,
        });
      }
    }

    // Parse the date to ensure it's not in the future
    const requestedDate = new Date(date);
    const today = new Date();
    
    // If date is in the future, use today's date instead
    const fetchDate = requestedDate > today 
      ? today.toISOString().split('T')[0]
      : date;

    // Fetch historical rate from exchangerate-api.com
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/history/USD/${fetchDate}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Return fallback rate if API fails
      return NextResponse.json({
        rates: { CAD: 1.35 },
        fallback: true,
      });
    }

    const data = await response.json();
    
    return NextResponse.json({
      rates: { CAD: data.rates?.CAD || 1.35 },
      date: fetchDate,
      fallback: false,
    });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    
    // Return fallback rate
    return NextResponse.json({
      rates: { CAD: 1.35 },
      fallback: true,
    });
  }
}
