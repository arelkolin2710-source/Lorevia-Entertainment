// Ikon Lorevia: mengganti semua emoji (termasuk yang dibuat lewat JavaScript) menjadi ikon SVG.
// Ikon diambil dari sprite assets/icons/sprite.svg (Material Design Icons, lisensi Apache 2.0).
(function () {
    var SPRITE = 'assets/icons/sprite.svg';
    var MAP = {"✨": "shimmer", "🌟": "star", "🌸": "flower", "🦋": "butterfly", "💛": "heart", "🎀": "ribbon", "🎧": "headphones", "🎬": "movie-open", "💬": "message-text", "🏆": "trophy", "🛍️": "shopping", "🛍": "shopping", "⚠️": "alert", "⚠": "alert", "🍀": "clover", "🌼": "flower-tulip", "🏠": "home", "💌": "email-heart-outline", "🔎": "magnify", "📣": "bullhorn", "📮": "mailbox", "🌿": "leaf", "🌱": "sprout", "🛡️": "shield-check", "🛡": "shield-check", "❤️": "heart", "❤": "heart", "🤍": "heart-outline", "🎉": "party-popper", "👁️": "eye", "👁": "eye", "🔒": "lock", "→": "arrow-right", "🔊": "volume-high", "🗓️": "calendar", "🗓": "calendar", "🔇": "volume-off", "⏳": "timer-sand", "📢": "bullhorn", "📄": "file-document", "❚❚": "pause", "🎵": "music-note", "🎟️": "ticket-percent", "🎟": "ticket-percent", "🔐": "lock", "📅": "calendar", "✓": "check", "🔍": "magnify"};
    var COLORS = {"❤️": "#ef4444", "❤": "#ef4444", "⚠️": "#f59e0b", "⚠": "#f59e0b"};
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; }).map(esc);
    // Emoji yang tidak ada di peta ikut dibuang supaya tidak muncul sebagai emoji.
    var RE = new RegExp(keys.join('|') + '|\\uFE0F|[\\u{1F000}-\\u{1FAFF}\\u2600-\\u27BF\\u2B00-\\u2BFF]', 'gu');
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, TITLE: 1, NOSCRIPT: 1, SVG: 1, INPUT: 1 };

    function iconNode(emoji) {
        var name = MAP[emoji];
        if (!name) return null;
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'ico');
        svg.setAttribute('aria-hidden', 'true');
        if (COLORS[emoji]) svg.style.color = COLORS[emoji];
        var use = document.createElementNS(NS, 'use');
        use.setAttribute('href', SPRITE + '#' + name);
        svg.appendChild(use);
        return svg;
    }

    function plain(s) { return String(s == null ? '' : s).replace(RE, '').replace(/ {2,}/g, ' ').trim(); }

    function convertText(node) {
        var text = node.nodeValue;
        RE.lastIndex = 0;
        if (!RE.test(text)) return;
        RE.lastIndex = 0;
        var frag = document.createDocumentFragment(), last = 0, m;
        while ((m = RE.exec(text))) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            var ic = iconNode(m[0]);
            if (ic) frag.appendChild(ic);
            last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
    }

    function convertAttrs(el) {
        ['placeholder', 'title', 'alt', 'aria-label'].forEach(function (a) {
            var v = el.getAttribute && el.getAttribute(a);
            if (v) { RE.lastIndex = 0; if (RE.test(v)) el.setAttribute(a, plain(v)); }
        });
        if (el.tagName === 'OPTION') {
            RE.lastIndex = 0;
            if (RE.test(el.textContent)) el.textContent = plain(el.textContent);
        }
    }

    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            if (root.parentNode && !SKIP[root.parentNode.nodeName.toUpperCase()]) convertText(root);
            return;
        }
        if (root.nodeType !== 1 || SKIP[root.nodeName.toUpperCase()] && root.nodeName.toUpperCase() !== 'OPTION') return;
        var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode: function (n) {
                if (n.nodeType === 1) return SKIP[n.nodeName.toUpperCase()] && n.nodeName.toUpperCase() !== 'OPTION' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var texts = [], n;
        while ((n = tw.nextNode())) texts.push(n);
        texts.forEach(function (t) { if (t.parentNode && !SKIP[t.parentNode.nodeName.toUpperCase()]) convertText(t); });
        convertAttrs(root);
        if (root.querySelectorAll) root.querySelectorAll('[placeholder],[title],[alt],[aria-label],option').forEach(convertAttrs);
    }

    // alert / confirm / prompt hanya bisa menampilkan teks, jadi emoji di dalamnya dibuang.
    ['alert', 'confirm', 'prompt'].forEach(function (fn) {
        var orig = window[fn];
        window[fn] = function (msg) {
            var args = Array.prototype.slice.call(arguments);
            args[0] = plain(msg);
            return orig.apply(window, args);
        };
    });

    var pending = false, queue = [];
    var mo = new MutationObserver(function (list) {
        list.forEach(function (rec) {
            if (rec.type === 'characterData') queue.push(rec.target);
            else rec.addedNodes.forEach(function (n) { queue.push(n); });
        });
        if (pending) return;
        pending = true;
        Promise.resolve().then(function () {
            pending = false;
            var items = queue; queue = [];
            items.forEach(function (n) { if (n.isConnected) walk(n); });
        });
    });

    function start() {
        walk(document.body);
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    window.LoreviaIcons = { walk: walk, plain: plain };
})();
