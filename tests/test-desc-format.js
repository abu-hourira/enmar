const testInputs = [
  "Fresh organic tomatoes.\n\nSourced from Savar.\n- High in Lycopene\n- Pesticide Free\n\nVisit [Our Story](https://enmar.farm) or check https://example.com/info for details.",
  "Simple single line description",
  "How to cook:\n1. Step one\n2. Step two\n3. Step three\nEnjoy your meal!"
];

function escapeHTML(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function formatInline(str) {
  let s = escapeHTML(str);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)\"\'<>]+)\)/gi, '<a href="$2" target="_blank" rel="noopener noreferrer" class="desc-link">$1</a>');
  s = s.replace(/(^|[\s(])((https?:\/\/[^\s\)\"\'<>]+))/gi, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="desc-link">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
  s = s.replace(/`([^`]+)`/g, '<code class="desc-code">$1</code>');
  return s;
}

function formatDescription(text) {
  if (!text || !String(text).trim()) return '<p class="desc-p">Fresh from our partner farms, packed to order.</p>';
  const raw = String(text).replace(/\r\n|\r/g, '\n');
  const blocks = raw.split(/\n{2,}/);
  const out = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;
    const lines = block.split('\n');

    let currentList = null;
    let listItems = [];
    let textLines = [];

    function flushList() {
      if (currentList && listItems.length) {
        const tag = currentList;
        out.push(`<${tag} class="desc-list">${listItems.map(i => `<li>${formatInline(i)}</li>`).join('')}</${tag}>`);
        currentList = null;
        listItems = [];
      }
    }

    function flushText() {
      if (textLines.length) {
        out.push(`<p class="desc-p">${textLines.map(l => formatInline(l)).join('<br>')}</p>`);
        textLines = [];
      }
    }

    for (let l of lines) {
      const trimmed = l.trim();
      if (!trimmed) continue;

      if (/^#{1,4}\s+/.test(trimmed)) {
        flushList();
        flushText();
        out.push(`<h4 class="desc-subhead">${formatInline(trimmed.replace(/^#{1,4}\s+/, ''))}</h4>`);
      } else if (/^[-*•]\s+/.test(trimmed)) {
        flushText();
        if (currentList !== 'ul') {
          flushList();
          currentList = 'ul';
        }
        listItems.push(trimmed.replace(/^[-*•]\s+/, ''));
      } else if (/^\d+[\.\)]\s+/.test(trimmed)) {
        flushText();
        if (currentList !== 'ol') {
          flushList();
          currentList = 'ol';
        }
        listItems.push(trimmed.replace(/^\d+[\.\)]\s+/, ''));
      } else {
        flushList();
        textLines.push(l);
      }
    }
    flushList();
    flushText();
  }
  return out.join('');
}

testInputs.forEach((inp, i) => {
  console.log(`--- Test ${i + 1} ---`);
  console.log(formatDescription(inp));
});
