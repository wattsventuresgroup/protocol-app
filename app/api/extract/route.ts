import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are extracting supplement and wellness information from a medical appointment transcript, summary, or notes — including messy, partial, or conversational input (e.g. "she told me to take fish oil", "doc said try magnesium"). Extract everything the practitioner recommended, as well as supplements and wellness items the patient mentions already taking or being advised to take. Include items with confidence low rather than omitting them.

Recognize common abbreviations: Mag = Magnesium, Cal = Calcium, DHA, EPA, B12.

Return ONLY valid JSON with no preamble, no explanation, no markdown. Exact structure:
{ "supplements": [ { "name": "string", "dose": "string or null", "timing": "morning|midday|afternoon|evening|bedtime|asneeded", "cadence": "daily|everyother|xperweek|weekly|adhoc", "intakeConditions": "string or null", "notesForPatient": "string or null", "purchaseSource": "fullscript|amazon|pharmacy_otc|pharmacy_rx|brand_direct|custom|null", "confidence": "high|low" } ], "wellnessItems": [ { "category": "nutrition|testing|care", "name": "string", "note": "string or null", "cadence": "string or null", "confidence": "high|low" } ], "journalPrompts": [ { "symptom": "string", "instruction": "string or null" } ] }

Rules:
- Mark confidence low for anything ambiguous, conditional, casually mentioned, or where details are unclear
- Do not invent anything not in the text
- Include supplements already being taken if mentioned
- If dose is unclear or not mentioned, use null and mark confidence low
- If timing is unclear or not specified, use "asneeded"
- Categorize wellness: nutrition=food/diet/products, testing=labs/monitoring/blood work/follow-up appointments, care=movement/referrals/treatments/lifestyle
- Extract wellness items from follow-up notes, casual mentions, lab orders, and appointment recommendations`

type ContentBlock =
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }
  | { type: 'text'; text: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, images } = body as { text?: string; images?: string[] }

    if (!text?.trim() && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API not configured' }, { status: 500 })
    }

    let messageContent: string | ContentBlock[]

    if (images && images.length > 0) {
      const blocks: ContentBlock[] = images.map(base64 => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      }))
      blocks.push({ type: 'text', text: 'Extract all supplement and wellness recommendations from this document.' })
      messageContent = blocks
    } else {
      messageContent = text!
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: messageContent }],
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

    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    console.log('API response content:', cleaned)
    return NextResponse.json({ result: cleaned })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
