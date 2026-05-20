export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not found in environment' })

  try {
    const { type, prompt, html, instruction, topic } = req.body
    let systemPrompt = ''
    let userMessage = ''

    if (type === 'build') {
      systemPrompt = `You are an ecommerce web designer. Output ONLY raw HTML. No markdown. No code fences. No explanation. Start with <!DOCTYPE html> and end with </html>. The entire page background must be #ffffff white. All text must be #111111 dark. Never use dark backgrounds.`
      userMessage = `Create a white background Shopify-style dropshipping store for: ${prompt.description}. Use white (#ffffff) background everywhere. Dark (#111111) text everywhere. Use ${prompt.color || '#C8F135'} only for buttons. Include navbar, hero, 4 product cards with emoji and prices, benefits, testimonials, footer.`
    } else if (type === 'refine') {
      systemPrompt = `You are an expert web designer. Modify the provided HTML store based on the user's instruction. Return ONLY the complete updated HTML.`
      userMessage = `Here is the store HTML:\n\n${html}\n\nModify it: "${instruction}"\n\nReturn ONLY the complete updated HTML.`
    } else if (type === 'captions') {
      systemPrompt = `You are a social media expert for dropshipping brands. Write platform-optimized captions. Return ONLY valid JSON with no markdown or code fences.`
      userMessage = `Write social media captions for a dropshipping store about: "${topic}"\n\nReturn ONLY this JSON structure:\n{"tiktok":"...","youtube":"...","instagram":"...","tags_tiktok":["tag1","tag2","tag3"],"tags_youtube":["tag1","tag2"],"tags_instagram":["tag1","tag2","tag3"]}`
    } else {
      return res.status(400).json({ error: 'Invalid type' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'API error' })
    }

    const data = await response.json()
    const text = data.content.map(c => c.text || '').join('')
    const cleaned = text.replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    return res.status(200).json({ result: cleaned })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
