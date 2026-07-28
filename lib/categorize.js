const RULES = [
  { category: 'tax', keywords: ['irs', '1099', 'w-2', 'w2', 'tax return', 'turbotax', 'tax'] },
  { category: 'banking', keywords: ['bank', 'chase', 'amex', 'american express', 'wells fargo', 'citibank', 'statement'] },
  { category: 'utilities', keywords: ['con edison', 'coned', 'utility', 'electric', 'gas company', 'water bill', 'pg&e'] },
  { category: 'medical', keywords: ['blue cross', 'blueshield', 'health', 'medical', 'clinic', 'pharmacy', 'dental'] },
  { category: 'insurance', keywords: ['insurance', 'policy', 'state farm', 'geico', 'allstate', 'progressive'] },
  { category: 'housing', keywords: ['rent', 'mortgage', 'property tax', 'hoa', 'landlord', 'lease'] },
  { category: 'receipts', keywords: ['receipt', 'invoice', 'order confirmation', 'amazon', 'spotify', 'your order'] },
];

function categorize(fromAddr, subject) {
  const haystack = `${fromAddr || ''} ${subject || ''}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) return rule.category;
  }
  return 'uncategorized';
}

module.exports = { categorize };
