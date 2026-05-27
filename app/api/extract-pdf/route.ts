import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    const text = data.text?.trim() ?? ''

    if (text.length < 100) {
      return NextResponse.json(
        { error: "This PDF couldn't be read as text. Try copying and pasting the content instead." },
        { status: 422 }
      )
    }

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json(
      { error: "This PDF couldn't be read as text. Try copying and pasting the content instead." },
      { status: 500 }
    )
  }
}
