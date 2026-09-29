/*!
 * Historical 主题前端脚本（无依赖）
 * 移动端导航 / 阅读进度 / 目录高亮 / 回到顶部
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
})();
