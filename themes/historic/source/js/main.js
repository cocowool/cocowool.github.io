/*!
 * Historical 主题前端脚本（无依赖）
 * 移动端导航 / 阅读进度 / 目录高亮 / 回到顶部 / 代码块复制
 */
(function () {
  'use strict';

  function throttle(fn, wait) {
    var last = 0, timer = null;
    return function () {
      var now = Date.now(), args = arguments, self = this;
      var remain = wait - (now - last);
      if (remain <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(self, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(self, args);
        }, remain);
      }
    };
  }

  /* ---------------------------------------------------- 移动端导航展开 */
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  function closeNav() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (toggle) {
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav();
    });

    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });

    window.addEventListener('resize', throttle(function () {
      if (window.innerWidth > 720) closeNav();
    }, 200));
  }

  /* -------------------------------------------------------- 阅读进度条 */
  var bar = document.getElementById('reading-progress');
  var prose = document.querySelector('.is-post .prose');

  function updateProgress() {
    if (!bar || !prose) return;
    var rect = prose.getBoundingClientRect();
    var viewport = window.innerHeight;
    var scrollable = rect.height - viewport;
    var progress;

    if (scrollable > 0) {
      progress = -rect.top / scrollable;
    } else {
      progress = rect.bottom <= viewport ? 1 : 0;
    }
    progress = Math.min(1, Math.max(0, progress));
    bar.style.width = (progress * 100).toFixed(2) + '%';
  }

  /* --------------------------------------------------------- 回到顶部 */
  var toTop = document.getElementById('to-top');

  function updateToTop() {
    if (!toTop) return;
    var show = window.pageYOffset > 480;
    if (show) {
      toTop.removeAttribute('hidden');
      toTop.classList.add('is-visible');
    } else {
      toTop.classList.remove('is-visible');
      toTop.setAttribute('hidden', '');
    }
  }

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* --------------------------------------------------------- 目录高亮 */
  var toc = document.getElementById('toc');
  var headings = Array.prototype.slice.call(
    document.querySelectorAll('.prose h2[id], .prose h3[id]')
  );

  var idToLink = {};

  function idOf(link) {
    var href = link.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return '';
    var raw = href.slice(1);
    var decoded;
    try { decoded = decodeURIComponent(raw); } catch (e) { decoded = raw; }
    if (document.getElementById(raw)) return raw;
    if (document.getElementById(decoded)) return decoded;
    return '';
  }

  function setActive(id) {
    Object.keys(idToLink).forEach(function (key) {
      idToLink[key].classList.toggle('is-active', key === id);
    });
  }

  if (toc && headings.length) {
    Array.prototype.forEach.call(toc.querySelectorAll('a[href^="#"]'), function (link) {
      var id = idOf(link);
      if (id) idToLink[id] = link;
    });

    var onScrollForToc = function () {
      var current = headings[0].id;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 120) current = headings[i].id;
        else break;
      }
      setActive(current);
    };

    window.addEventListener('scroll', throttle(onScrollForToc, 120), { passive: true });
    onScrollForToc();
  }

  /* ----------------------------------------------------------- 监听滚动 */
  if (bar || toTop) {
    var onScroll = function () {
      updateProgress();
      updateToTop();
    };
    window.addEventListener('scroll', throttle(onScroll, 100), { passive: true });
    window.addEventListener('resize', throttle(onScroll, 200));
    onScroll();
  }

  /* ------------------------------------------------------ 代码块复制按钮 */
  // Hexo 高亮结构：figure.highlight > table > td.gutter / td.code > pre > span.line
  // 行号在 td.gutter，复制时只取 td.code，避免把 "1 2 3" 一起带进剪贴板。
  // 站点可能是 http（非安全上下文），navigator.clipboard 不可用时降级 execCommand。
  (function () {
    var SEL = '.prose figure.highlight, .prose pre';

    function insideHighlight(node) {
      var p = node.parentNode;
      while (p && p.nodeType === 1) {
        if (p.tagName === 'FIGURE' && p.className.indexOf('highlight') !== -1) return true;
        p = p.parentNode;
      }
      return false;
    }

    function codeText(block) {
      if (block.tagName !== 'FIGURE') return block.textContent || '';
      var cell = block.querySelector('td.code');
      if (!cell) return block.textContent || '';
      var lines = cell.querySelectorAll('.line');
      if (!lines.length) return cell.textContent || '';
      return Array.prototype.map.call(lines, function (line) {
        return (line.textContent || '').replace(/\r?\n$/, '');
      }).join('\n');
    }

    function legacyCopy(text) {
      // execCommand 需要临时 textarea 并会抢走选区，先存后还，别打断读者选中的文字
      var sel = window.getSelection();
      var saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (saved && sel) {
        sel.removeAllRanges();
        sel.addRange(saved);
      }
      return ok;
    }

    var ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' +
      '<rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M11 3.2H3.7A1.5 1.5 0 0 0 2.2 4.7V11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>';

    function enhance(block) {
      if (!(codeText(block) || '').trim()) return;

      var wrap = document.createElement('div');
      wrap.className = 'code-block';
      block.parentNode.insertBefore(wrap, block);
      wrap.appendChild(block);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.setAttribute('aria-label', '复制代码');
      btn.title = '复制代码';
      btn.innerHTML = ICON + '<span>复制</span>';
      wrap.appendChild(btn);

      var label = btn.querySelector('span');
      var timer = null;

      function feedback(ok) {
        label.textContent = ok ? '已复制' : '复制失败';
        btn.classList.toggle('is-done', ok);
        btn.classList.toggle('is-error', !ok);
        clearTimeout(timer);
        timer = setTimeout(function () {
          label.textContent = '复制';
          btn.classList.remove('is-done', 'is-error');
        }, 1800);
      }

      btn.addEventListener('click', function () {
        var text = codeText(block);
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { feedback(true); },
            function () { feedback(legacyCopy(text)); }
          );
        } else {
          feedback(legacyCopy(text));
        }
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll(SEL), function (block) {
      if (block.tagName === 'PRE' && insideHighlight(block)) return;
      enhance(block);
    });
  })();
})();
