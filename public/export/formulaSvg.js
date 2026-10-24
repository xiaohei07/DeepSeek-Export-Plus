// SVG is XML: HTML outerHTML may contain &nbsp; and omit namespace declarations.
// Serialize the entire tree as XML so spaces, escaping and nested MathML/SVG survive.
export function formulaSvg(element, css, width, height) {
  const doc = element.ownerDocument;
  const svgNS = "http://www.w3.org/2000/svg";
  const htmlNS = "http://www.w3.org/1999/xhtml";
  const svg = doc.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  const foreign = doc.createElementNS(svgNS, "foreignObject");
  foreign.setAttribute("width", "100%");
  foreign.setAttribute("height", "100%");
  const wrapper = doc.createElementNS(htmlNS, "div");
  wrapper.setAttribute(
    "style",
    "font-size:17px;line-height:1.8;color:#242b36;background:white",
  );
  const style = doc.createElementNS(htmlNS, "style");
  style.textContent = css;
  wrapper.append(style, element.cloneNode(true));
  foreign.append(wrapper);
  svg.append(foreign);
  return new doc.defaultView.XMLSerializer().serializeToString(svg);
}
