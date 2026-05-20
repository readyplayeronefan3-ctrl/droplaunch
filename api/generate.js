
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // DEBUG - check if env var is being received
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not found in environment' })

  try {
    const { type, prompt, html, instruction, topic } = req.body

    let systemPrompt = ''
    let userMessage = ''

  if (type === 'build') {
      systemPrompt = `You are an expert ecommerce store designer. Generate a complete single-page HTML dropshipping store. CRITICAL RULES: Background MUST be white (#ffffff). All body text MUST be dark (#111111). Navigation background is white with dark text. Only use the accent color ${prompt.color || '#C8F135'} for buttons and highlights. Must look like a real Shopify store - bright, clean, professional. Include: navbar, hero section, 4 product cards with prices, features section, footer. Mobile responsive. Output ONLY complete HTML from <!DOCTYPE html> to </html>.`
      userMessage = `Create a bright white professional dropshipping store for: ${prompt.description}`
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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'API error', key_prefix: apiKey.substring(0, 10) })
    }

    const data = await response.json()
    const text = data.content.map(c => c.text || '').join('')
    return res.status(200).json({ result: text })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
