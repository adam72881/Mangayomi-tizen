/* Document and Element for Mangayomi extensions.
   selectFirst always returns an Element. A miss is empty: text and
   attributes are "", never null. */
(function () {
  const Mly = (window.Mly = window.Mly || {});

  function first(html, re) {
    const m = re.exec(html || "");
    return m && m[1] != null ? m[1] : "";
  }
  function hrefOf(node) {
    if (!node || !node.outerHTML) return "";
    return first(node.outerHTML, /href="([^"]*)"/i) || node.getAttribute?.("href") || "";
  }
  function srcOf(node) {
    if (!node || !node.outerHTML) return "";
    return first(node.outerHTML, /src="([^"]*)"/i);
  }

  class Element {
    constructor(node) { this.node = node || null; }
    get text() { return this.node ? this.node.textContent || "" : ""; }
    get outerHtml() { return this.node ? this.node.outerHTML || "" : ""; }
    get innerHtml() { return this.node ? this.node.innerHTML || "" : ""; }
    get className() { return this.node && this.node.className ? String(this.node.className) : ""; }
    get localName() { return this.node ? this.node.localName || "" : ""; }
    get namespaceUri() { return this.node ? this.node.namespaceURI || "" : ""; }
    get getSrc() { return srcOf(this.node); }
    get getImg() { return this.node ? first(this.node.outerHTML, /img="([^"]*)"/i) : ""; }
    get getHref() { return hrefOf(this.node); }
    get getDataSrc() { return this.node ? first(this.node.outerHTML, /data-src="([^"]*)"/i) : ""; }
    get previousElementSibling() { return new Element(this.node && this.node.previousElementSibling); }
    get nextElementSibling() { return new Element(this.node && this.node.nextElementSibling); }
    get children() { return this.node ? [...this.node.children].map((n) => new Element(n)) : []; }
    getElementsByTagName(name) {
      return this.node ? [...this.node.getElementsByTagName(name)].map((n) => new Element(n)) : [];
    }
    getElementsByClassName(name) {
      return this.node ? [...this.node.getElementsByClassName(name)].map((n) => new Element(n)) : [];
    }
    attr(name) {
      if (!this.node || !this.node.getAttribute) return "";
      const v = this.node.getAttribute(name);
      return v == null ? "" : v;
    }
    hasAttr(name) { return !!(this.node && this.node.hasAttribute && this.node.hasAttribute(name)); }
    select(selector) {
      if (!this.node || !this.node.querySelectorAll) return [];
      try { return [...this.node.querySelectorAll(selector)].map((n) => new Element(n)); }
      catch (e) { return []; }
    }
    selectFirst(selector) {
      if (!this.node || !this.node.querySelector) return new Element(null);
      try { return new Element(this.node.querySelector(selector)); }
      catch (e) { return new Element(null); }
    }
    xpathFirst(expr) { return xpathString(this.node, expr); }
    xpath(expr) { return xpathAll(this.node, expr); }
  }

  function xpathString(node, expr) {
    if (!node) return "";
    try {
      const doc = node.ownerDocument || node;
      const r = doc.evaluate(expr, node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const n = r.singleNodeValue;
      if (!n) return "";
      return n.nodeType === Node.ATTRIBUTE_NODE ? n.value || "" : n.textContent || "";
    } catch (e) { return ""; }
  }
  function xpathAll(node, expr) {
    if (!node) return [];
    try {
      const doc = node.ownerDocument || node;
      const r = doc.evaluate(expr, node, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (r.snapshotLength < 2) return [];
      const out = [];
      for (let i = 0; i < r.snapshotLength; i++) {
        const n = r.snapshotItem(i);
        out.push((n.nodeType === Node.ATTRIBUTE_NODE ? n.value : n.textContent) || "");
      }
      return out;
    } catch (e) { return []; }
  }

  class Document {
    constructor(html) {
      this.html = html == null ? "" : String(html);
      this._doc = new DOMParser().parseFromString(this.html, "text/html");
    }
    get body() { return new Element(this._doc.body); }
    get documentElement() { return new Element(this._doc.documentElement); }
    get head() { return new Element(this._doc.head); }
    get parent() { return new Element(null); }
    get text() { return this._doc.documentElement ? this._doc.documentElement.textContent || "" : ""; }
    get outerHtml() { return this._doc.documentElement ? this._doc.documentElement.outerHTML || "" : ""; }
    select(selector) {
      try { return [...this._doc.querySelectorAll(selector)].map((n) => new Element(n)); }
      catch (e) { return []; }
    }
    selectFirst(selector) {
      try { return new Element(this._doc.querySelector(selector)); }
      catch (e) { return new Element(null); }
    }
    get children() { return [...this._doc.children].map((n) => new Element(n)); }
    getElementsByTagName(name) { return [...this._doc.getElementsByTagName(name)].map((n) => new Element(n)); }
    getElementsByClassName(name) { return [...this._doc.getElementsByClassName(name)].map((n) => new Element(n)); }
    getElementById(id) { return new Element(this._doc.getElementById(id)); }
    attr(name) {
      const el = this._doc.documentElement;
      if (!el) return "";
      const v = el.getAttribute(name);
      return v == null ? "" : v;
    }
    hasAttr(name) { return !!(this._doc.documentElement && this._doc.documentElement.hasAttribute(name)); }
    xpathFirst(expr) { return xpathString(this._doc, expr); }
    xpath(expr) { return xpathAll(this._doc, expr); }
  }

  Mly.dom = { Document, Element };
})();
