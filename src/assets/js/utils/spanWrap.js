export default function spanWrap(el, counter = { value: 0 }) {
  const nodes = [...el.childNodes];
  let spanWrapText = "";
  const localCounter = { value: 0 };

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\r?\n/g, "");
      if (text?.trim()) {
        spanWrapText += text.split("").reduce((acc, v) => {
          return acc + `<span class="js-text" style="--index: ${localCounter.value++};">${v}</span>`;
        }, "");
      }
    } else if (node instanceof Element) {
      if (node.tagName.toLowerCase() === 'br') {
        spanWrapText += '<br>';
        return;
      }

      if (!node.textContent?.trim()) {
        return;
      }

      const originalTag = node.tagName.toLowerCase();
      const originalAttributes = Array.from(node.attributes)
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');

      const text = node.textContent?.replace(/\r?\n/g, "");
      const wrappedContent = text?.split("").reduce((acc, v) => {
        return acc + `<span class="js-text" style="--index: ${localCounter.value++};">${v}</span>`;
      }, "");

      spanWrapText += originalAttributes
        ? `<${originalTag} ${originalAttributes}>${wrappedContent}</${originalTag}>`
        : `<${originalTag}>${wrappedContent}</${originalTag}>`;
    }
  });

  el.innerHTML = spanWrapText;
}
