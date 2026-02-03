import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Recommendations API
 * POST /api/ai/recommendations
 * 
 * Analyzes detector opportunities and provides AI-powered recommendations
 */

interface Opportunity {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  entity_type: string;
  entity_id?: string;
  confidence_score: number;
  potential_impact_score: number;
  urgency_score: number;
  recommended_actions: string[];
  metrics?: Record<string, any>;
  evidence?: Record<string, any>;
}

interface AIRecommendation {
  summary: string;
  prioritizedActions: Array<{
    action: string;
    rationale: string;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
  quickWins: string[];
  strategicInsights: string[];
  riskAssessment: string;
}

export async function POST(request: NextRequest) {
  try {
    const { opportunities, category, context } = await request.json();

    if (!opportunities || !Array.isArray(opportunities)) {
      return NextResponse.json(
        { error: 'Missing or invalid opportunities array' },
        { status: 400 }
      );
    }

    // Get Gemini API key from environment
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      console.error('GEMINI_API env var is missing');
      return NextResponse.json(
        { error: 'GEMINI_API not configured. Please add GEMINI_API to environment variables.' },
        { status: 500 }
      );
    }

    console.log('Gemini API key found, length:', apiKey.length);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    console.log('Sending request to Gemini with', opportunities.length, 'opportunities');

    // Prepare the prompt
    const opportunitiesSummary = opportunities.map((opp: Opportunity) => ({
      title: opp.title,
      description: opp.description,
      priority: opp.priority,
      category: opp.category,
      entity: opp.entity_id || 'N/A',
      confidence: opp.confidence_score,
      impact: opp.potential_impact_score,
      urgency: opp.urgency_score,
      suggestedActions: opp.recommended_actions,
      metrics: opp.metrics,
      evidence: opp.evidence,
    }));

    const prompt = `You are a senior marketing operations consultant analyzing detector-identified opportunities for a business. Based on the following opportunities data, provide strategic recommendations.

${category ? `Focus area: ${category}` : 'All marketing channels'}

${context ? `Additional context: ${context}` : ''}

OPPORTUNITIES DATA:
${JSON.stringify(opportunitiesSummary, null, 2)}

Please analyze these opportunities and provide:

1. **Executive Summary** (2-3 sentences): What's the overall health and key takeaway?

2. **Prioritized Action Plan** (top 3-5 actions): For each action include:
   - Specific action to take
   - Rationale (why this matters)
   - Effort level (low/medium/high)
   - Expected impact (low/medium/high)
   - Recommended timeframe (e.g., "this week", "next 2 weeks", "this month")

3. **Quick Wins** (2-3 items): Actions that can be done today with immediate impact

4. **Strategic Insights** (2-3 items): Longer-term patterns or opportunities worth investigating

5. **Risk Assessment** (1-2 sentences): What happens if these issues aren't addressed?

Format your response as JSON matching this structure:
{
  "summary": "Executive summary here...",
  "prioritizedActions": [
    {
      "action": "Specific action",
      "rationale": "Why this matters",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "timeframe": "this week"
    }
  ],
  "quickWins": ["Quick win 1", "Quick win 2"],
  "strategicInsights": ["Insight 1", "Insight 2"],
  "riskAssessment": "Risk assessment here..."
}

Respond ONLY with valid JSON, no additional text or markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    let recommendations: AIRecommendation;
    try {
      // Clean up the response (remove markdown code blocks if present)
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      recommendations = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response',
          rawResponse: text
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recommendations,
      analyzedCount: opportunities.length,
      category: category || 'all',
    });

  } catch (error: any) {
    console.error('AI Recommendations error:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    // Check for specific Gemini errors
    let errorMessage = 'Failed to generate AI recommendations';
    if (error?.message?.includes('API_KEY')) {
      errorMessage = 'Invalid Gemini API key. Please check your GEMINI_API environment variable.';
    } else if (error?.message?.includes('quota')) {
      errorMessage = 'Gemini API quota exceeded. Please try again later.';
    } else if (error?.message?.includes('blocked')) {
      errorMessage = 'Content was blocked by Gemini safety filters.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
