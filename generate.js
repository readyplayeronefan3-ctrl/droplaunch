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

      // Build product list string if products were provided
      const productList = prompt.products && prompt.products.length
        ? '\n\nProducts to feature (use EXACTLY these — names, prices, emojis):\n' +
          prompt.products.map(p => `- ${p.emoji} ${p.name} — ${p.price}${p.desc ? ': ' + p.desc : ''}`).join('\n')
        : ''

      systemPrompt = `You are a world-class ecommerce web designer. Output ONLY raw complete HTML. Never use markdown code fences. Never add any explanation before or after the HTML. Your output must start with <!DOCTYPE html> and end with </html>. ${themeInstruction} Accent color: ${prompt.color || '#C8F135'} — use ONLY for buttons, highlights, and badges, never as a background. Style direction: ${prompt.style || 'modern'}. The final result must look like a premium real Shopify store — professional, polished, ready to sell.`

      userMessage = `Create a complete professional dropshipping store for: ${prompt.description}${productList}

Include ALL of the following sections:
1. Sticky navbar — logo on left, nav links center, cart icon right, mobile hamburger menu
2. Hero section — bold headline, supporting subtext, primary CTA button, subtle background
3. Product grid — show ALL provided products as cards with emoji, name, description, price, and "Add to Cart" button
4. Benefits section — 4 benefit cards each with an icon, bold title, and short description
5. Testimonials — 3 customer reviews with star ratings, quote, and customer name
6. Newsletter signup — email input with subscribe button and short value proposition
7. Footer — logo, tagline, 3 link columns (Shop, Company, Support), copyright

Design rules:
- Smooth hover transitions on all buttons and cards (transform, box-shadow)
- Fully mobile responsive — hamburger menu collapses nav on small screens
- Consistent spacing and typography throughout
- Accent color only on CTAs and highlights, never as page background`

    } else if (type === 'refine') {
      systemPrompt = `You are an expert web designer. Modify the provided HTML store based on the user's instruction. Preserve the overall design, theme, and structure unless explicitly told to change them. Return ONLY the complete updated HTML starting with <!DOCTYPE html> and ending with </html>. No explanation. No markdown.`
      userMessage = `Here is the current store HTML:\n\n${(html || '').substring(0, 10000)}\n\nApply this change: "${instruction}"\n\nReturn ONLY the complete updated HTML.`

    } else if (type === 'captions') {
      systemPrompt = `You are a viral social media expert for ecommerce and dropshipping brands. Write engaging, platform-native captions that drive clicks and sales. Return ONLY valid JSON — no markdown, no code fences, no explanation before or after.`
      userMessage = `Write social media captions for a dropshipping store about: "${topic}"

Return ONLY this exact JSON structure (no extra text):
{
  "tiktok": "hook-first caption under 150 chars, conversational, trending energy",
  "youtube": "SEO-optimized title + 2 sentence description with keywords",
  "instagram": "storytelling caption 100-150 chars with emojis",
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

    // Strip any markdown code fences the model might add despite instructions
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
