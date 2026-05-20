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
      const themeInstruction = prompt.theme || 'Use a LIGHT theme: white backgrounds (#ffffff), dark text (#111111).'
      const productList = prompt.products && prompt.products.length
        ? '\n\nProducts to feature (use EXACTLY these):\n' +
          prompt.products.map(p => `- ${p.emoji} ${p.name} — ${p.price}${p.desc ? ': ' + p.desc : ''}`).join('\n')
        : ''
      systemPrompt = `You are a world-class ecommerce web designer. Output ONLY raw complete HTML. Never use markdown code fences. Never add any explanation. Your output must start with <!DOCTYPE html> and end with </html>. ${themeInstruction} Accent color: ${prompt.color || '#C8F135'} — use ONLY for buttons, highlights, and badges. Style: ${prompt.style || 'modern'}. Make it look like a premium real Shopify store.`
      userMessage = `Create a complete professional dropshipping store for: ${prompt.description}${productList}

Include ALL of these sections:
1. Sticky navbar — logo left, nav links center, cart icon right, mobile hamburger menu
2. Hero section — bold headline, subtext, CTA button
3. Product grid — ALL provided products as cards with emoji, name, description, price, Add to Cart button
4. Benefits section — 4 benefit cards with icon, title, description
5. Testimonials — 3 reviews with star ratings and customer name
6. Newsletter signup — email input and subscribe button
7. Footer — logo, tagline, 3 link columns, copyright

Rules:
- Smooth hover transitions on all buttons and cards
- Fully mobile responsive with hamburger menu
- Accent color only on CTAs and highlights, never as page background`

    } else if (type === 'refine') {
      systemPrompt = `You are an expert web designer. Modify the provided HTML store based on the user's instruction. Preserve the overall design and structure unless told to change them. Return ONLY the complete updated HTML starting with <!DOCTYPE html> and ending with </html>. No explanation. No markdown.`
      userMessage = `Here is the current store HTML:\n\n${(html || '').substring(0, 10000)}\n\nApply this change: "${instruction}"\n\nReturn ONLY the complete updated HTML.`

    } else if (type === 'captions') {
      systemPrompt = `You are a viral social media expert for ecommerce brands. Write engaging platform-native captions that drive clicks and sales. Return ONLY valid JSON — no markdown, no code fences, no explanation.`
      userMessage = `Write social media captions for a dropshipping store about: "${topic}"

Return ONLY this exact JSON (no extra text):
{
  "tiktok": "hook-first caption under 150 chars",
  "youtube": "SEO title + 2 sentence description",
  "instagram": "storytelling caption with emojis",
  "tags_tiktok": ["tag1","tag2","tag3","tag4","tag5"],
  "tags_youtube": ["tag1","tag2","tag3"],
  "tags_instagram": ["tag1","tag2","tag3","tag4","tag5"]
}`

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
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' })
    }

    const data = await response.json()
    const text = data.content.map(c => c.text || '').join('')
    const cleaned = text
      .replace(/^```html\n?/i, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    return res.status(200).json({ result: cleaned })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
