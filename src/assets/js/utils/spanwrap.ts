export const spanWrap = (el: HTMLElement) => {
  const nodes = [...el.childNodes];

  let spanWrapText = "";

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // テキストの場合
      const text = node.textContent?.replace(/\r?\n/g, ""); // テキストから改行コード削除
      // spanで囲んで連結
      spanWrapText += text?.split("").reduce((acc, v) => {
        return acc + `<span>${v}</span>`;
      }, "");
    } else if (node instanceof Element) {
      // テキスト以外 (Element)
      // <br>などテキスト以外の要素をそのまま連結
      spanWrapText += node.outerHTML;
    } else {
      // それ以外のノード（念のため）
      spanWrapText += node.textContent || "";
    }
  });

  el.innerHTML = spanWrapText;
};
