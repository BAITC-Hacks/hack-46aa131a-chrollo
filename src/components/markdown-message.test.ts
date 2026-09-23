import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MarkdownMessage } from "./markdown-message";
it("renders emphasis, lists and comparison tables as semantic HTML", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownMessage, {
      content:
        "**Итог**\n\n- Школа\n- Поликлиника\n\n| План | Score |\n| --- | --- |\n| A | 56,54 |",
    }),
  );
  expect(html).toContain("<strong>Итог</strong>");
  expect(html).toContain("<li>Школа</li>");
  expect(html).toContain("<table>");
});
it("never renders raw HTML, script links or remote images from model text", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownMessage, {
      content:
        '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[опасно](javascript:alert%281%29)\n\n![image](https://example.test/tracker.png)',
    }),
  );
  expect(html).not.toMatch(/<script|<img|href="javascript:|onerror=/i);
});
