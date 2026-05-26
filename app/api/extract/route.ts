import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are extracting supplement and wellness information from a medical appointment transcript or summary. Extract everything the practitioner recommended. Return ONLY valid JSON with no preamble, no explanation, no markdown. Exact structure: { "supplements": [ { "name": "string", "dose": "string or null", "timing": "morning|midday|afternoon|evening|bedtime|asneeded", "cadence": "daily|everyother|xperweek|weekly|adhoc", "intakeConditions": "string or null", "notesForPatient": "string or null", "purchaseSource": "fullscript|amazon|pharmacy_otc|pharmacy_rx|brand_direct|custom|null", "confidence": "high|low" } ], "wellnessItems": [ { "category": "nutrition|testing|care", "name": "string", "note": "string or null", "cadence": "string or null", "confidence": "high|low" } ], "journalPrompts": [ { "symptom": "string", "instruction": "string or null" } ] }. Rules: Mark confidence low for anything ambiguous or conditional. Do not invent anything not in the text. Include supplements already being taken if mentioned. Categorize wellness: nutrition=food/diet/products, testing=labs/monitoring, care=movement/referrals/treatments.`

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'API error' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      return NextResponse.json({ error: 'Empty response' }, { status: 500 })
    }

    return NextResponse.json({ result: content })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
