const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function generateContentCalendar(input) {
  const { niche, platform, goal, tone } = input;

  const systemPrompt = `You are a social media marketing strategist expert.
Your task is to generate a 30-day content calendar for ${platform}.
Return ONLY valid JSON, no other text or markdown.
The JSON must follow this exact structure:
{
  "planName": "string",
  "platform": "string",
  "posts": [
    {
      "day": number,
      "format": "string",
      "caption": "string",
      "hashtags": ["string"],
      "time": "HH:MM"
    }
  ]
}`;

  const userPrompt = `Create a 30-day content calendar with these details:
- Niche: ${niche}
- Platform: ${platform}
- Goal: ${goal}
- Tone: ${tone}

Generate 30 posts with:
- Appropriate content formats (${getFormatsForPlatform(platform)})
- Engaging captions optimized for ${platform}
- Relevant hashtags for ${niche}
- Optimal posting times for ${platform}

Return only the JSON, nothing else.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.7,
      max_tokens: 8000,
    });

    const content = chatCompletion.choices[0]?.message?.content || '';
    
    // Extract JSON from response (in case there's markdown)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(jsonStr);
    return result;
  } catch (error) {
    console.error('Groq API Error:', error);
    throw new Error('Failed to generate content calendar: ' + error.message);
  }
}

function getFormatsForPlatform(platform) {
  const formats = {
    instagram: 'post, reel, story, carousel',
    linkedin: 'post, article, poll',
    x: 'tweet, thread, poll',
    tiktok: 'video, duet, stitch'
  };
  return formats[platform.toLowerCase()] || 'post';
}

module.exports = { generateContentCalendar };