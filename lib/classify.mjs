const AI_PATTERNS = [
  ['GPTBot / ChatGPT', /gptbot|chatgpt-user|oai-searchbot/i],
  ['Claude / Anthropic', /claudebot|claude-web|anthropic-ai/i],
  ['Perplexity', /perplexitybot|perplexity-user/i],
  ['Google AI', /google-extended/i],
  ['Common Crawl', /ccbot/i],
  ['ByteDance', /bytespider/i],
  ['Cohere', /cohere-ai/i],
  ['Meta AI', /meta-externalagent|meta-externalfetcher/i],
  ['Apple AI', /applebot-extended/i],
];

const BOT_PATTERN = /bot|crawler|spider|headless|curl|wget|python-requests|python-urllib|httpx|go-http-client|scrapy|selenium|playwright|puppeteer/i;

export function classify(session) {
  const reasons = [];
  let score = 0;
  const ua = session.userAgent || '';
  const knownAi = AI_PATTERNS.find(([, pattern]) => pattern.test(ua));

  if (knownAi) {
    score += 85;
    reasons.push(`既知のAI識別子: ${knownAi[0]}`);
  } else if (BOT_PATTERN.test(ua)) {
    score += 55;
    reasons.push('Bot・自動化ツールの識別子');
  }

  if (!ua.startsWith('Mozilla/')) {
    score += 15;
    reasons.push('一般的なブラウザ以外のUser-Agent');
  }
  if (!session.acceptLanguage) {
    score += 8;
    reasons.push('言語ヘッダーなし');
  }
  if (!session.fetchMode) {
    score += 8;
    reasons.push('ブラウザのFetchヘッダーなし');
  }

  const behavior = session.behavior;
  if (!behavior && session.ageSeconds >= 60) {
    score += 25;
    reasons.push('ページ内JavaScriptの行動記録なし');
  }

  if (behavior) {
    const interactions = behavior.mouseMoves + behavior.clicks + behavior.keydowns;
    if (behavior.webdriver) {
      score += 40;
      reasons.push('自動ブラウザ制御フラグ');
    }
    if (behavior.duration < 2 && interactions === 0) {
      score += 20;
      reasons.push('極端に短い無操作アクセス');
    }
    if (behavior.duration >= 8 && interactions === 0) {
      score += 18;
      reasons.push('滞在中の操作なし');
    }
    if (behavior.scrollDepth === 0 && interactions === 0) {
      score += 10;
      reasons.push('スクロール・入力なし');
    }
    if (behavior.mouseMoves >= 5) {
      score -= 25;
      reasons.push('連続したポインター操作');
    }
    if (behavior.clicks > 0) {
      score -= 15;
      reasons.push('クリック操作');
    }
    if (behavior.scrollDepth >= 30) {
      score -= 10;
      reasons.push('ページをスクロール');
    }
    if (behavior.duration >= 20) {
      score -= 10;
      reasons.push('一定時間の滞在');
    }
  }

  score = Math.max(0, Math.min(100, score));
  const classification = score >= 65
    ? 'AI・Botの可能性が高い'
    : score >= 35
      ? '自動アクセスの疑い'
      : '人間の可能性が高い';

  return { score, classification, reasons };
}
