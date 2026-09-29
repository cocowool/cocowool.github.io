/**
 * Historical 主题脚本
 *
 * 这里注册的东西会直接暴露给 EJS 模板使用：
 *   reading_time()   阅读时长
 *   word_count()     字数
 *   post_category()  取文章的第一个分类（首页卡片用它替代作者名）
 *   excerpt_text()   纯文本摘要
 *   ad_slot()        渲染 Google AdSense 广告位
 *   sidebar_count()  侧栏快捷入口后面的计数
 *   group_by_year()  归档 / 分类 / 标签页按年份分组
 *   category_desc()  分类简介（读 source/_data/categories.yml）
 *   links_count()    友链总数
 *   theme_asset()    个人图片资源解析（头像 / 二维码 / favicon）
 *
 * 注意：所有 helper 都刻意写成 fn.length <= 1（多参数用 arguments 取），
 * 因为 Hexo 会对 length > 1 的 helper 做 Promise 包装，模板里会渲染成 [object Promise]。
 */

var fs = require('fs');
var path = require('path');

/* ------------------------------------------------------------------ 工具 */

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '——')
    .replace(/\s+/g, ' ')
    .trim();
}

// 中日韩字符按「字」算，西文按「词」算
function countWords(text) {
  var cjkRe = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
  var cjk = (text.match(cjkRe) || []).length;
  var rest = text.replace(cjkRe, ' ');
  var words = (rest.match(/[A-Za-z0-9_'’-]+/g) || []).length;
  return cjk + words;
}

function queryToArray(query) {
  var out = [];
  if (!query) return out;
  if (typeof query.each === 'function') {
    query.each(function (item) { out.push(item); });
  } else if (Array.isArray(query)) {
    out = query.slice();
  }
  return out;
}

function dataFile(name) {
  var data = hexo.locals.get('data') || {};
  return data[name];
}

function linksGroups() {
  var groups = dataFile('links');
  return Array.isArray(groups) ? groups : [];
}

// 从 URL 里取出主机名，用作没填名字时的兜底显示
function hostOf(url) {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

// 独立博客清单：把两种数据源归一化成同一组字段，页面和侧栏计数都用它。
//   1. source/_data/blogs.json   爬虫产出，字段 name/url/description/rss/status/added_date
//   2. source/_data/links.yml    手工维护的老分组格式
// 归一化后统一为 { name, url, desc, rss, status, date }。
// 放在这里而不是模板里，是为了让「列表」和「计数」永远取自同一份数据。
function blogItems() {
  var out = [];
  var blogs = dataFile('blogs');

  function push(name, url, desc, rss, status, date) {
    url = String(url || '').trim();
    if (!url) return;
    out.push({
      name:   String(name || hostOf(url)).trim() || hostOf(url),
      url:    url,
      host:   hostOf(url),
      desc:   String(desc || '').trim(),
      rss:    String(rss || '').trim(),
      status: String(status || '').trim() || 'active',
      date:   String(date || '').trim()
    });
  }

  if (Array.isArray(blogs) && blogs.length) {
    blogs.forEach(function (b) {
      if (!b) return;
      push(b.name, b.url || b.link, b.description || b.desc, b.rss, b.status, b.added_date || b.date);
    });
    return out;
  }

  linksGroups().forEach(function (g) {
    if (!g) return;
    ((g && g.items) || []).forEach(function (it) {
      if (!it) return;
      push(it.name, it.url || it.link, it.desc || it.description, it.rss, it.status, it.date || it.added_date);
    });
  });
  return out;
}

/* ------------------------------------------------------------ 个人图片资源 */

// 逻辑资源名 → 主题配置里的候选键（按顺序取第一个非空值）。
// 前面的键是新版统一入口，后面那个是历史字段，保证旧配置继续可用。
var ASSET_KEYS = {
  avatar: ['assets.avatar', 'author.avatar'],
  favicon: ['assets.favicon', 'favicon'],
  wechat_qr: ['assets.wechat_qr', 'sidebar.wechat.qrcode'],
  og_image: ['assets.og_image']
};

// 主题内置了同名默认图的资源名；没列的（如 og_image）解析不到就返回空，
// 不会指到一个并不存在的文件上
var ASSET_FALLBACK = { avatar: true, favicon: true, wechat_qr: true };

var ASSET_IMAGE_EXT = /^\.(svg|png|jpe?g|webp|gif|avif|ico)$/i;
var ASSET_OFF_VALUES = /^(none|false|off|null|0)$/i;

function themeConfig() {
  return (hexo.theme && hexo.theme.config) || {};
}

// 取 'a.b.c' 形式的配置值，取不到返回空串
function configPath(obj, keyPath) {
  var cur = obj;
  var parts = String(keyPath || '').split('.');
  for (var i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur === 'boolean') return '';
  return String(cur).trim();
}

function isExternalUrl(p) {
  return /^(https?:)?\/\//i.test(p) || p.indexOf('data:') === 0;
}

// url_for 内部要读 this.config，直接调用会炸，必须绑到 hexo 上。
// 万一它在某个阶段不可用，退回到按 root 手工拼接（我们只传绝对路径，行为一致）。
function urlFor(p) {
  p = String(p || '');
  if (!p || isExternalUrl(p)) return p;

  var fn = hexo.extend.helper.get('url_for');
  if (fn) {
    try {
      var out = fn.call(hexo, p);
      if (out) return out;
    } catch (e) { /* 落到手工拼接 */ }
  }

  var root = (hexo.config && hexo.config.root) || '/';
  if (!/^\//.test(p)) p = '/' + p;
  if (root === '/' || root === '') return p;
  return root.replace(/\/+$/, '') + p;
}

// 站点内个人资源目录，相对站点 source/。默认与主题的 image/ 错开，避免路径撞车
function assetsDir() {
  var d = configPath(themeConfig(), 'assets.dir') || 'assets';
  return d.replace(/^\/+|\/+$/g, '');
}

// 扫描站点 source/<dir>/ 下的图片，按「文件名去掉后缀」建索引，每个目录只扫一次。
// dir 传空串表示 source 根目录——Hexo 惯例是把 favicon.ico 直接放这里。
var assetCache = {};

function scanAssets(dir) {
  if (assetCache[dir]) return assetCache[dir];
  var out = {};
  assetCache[dir] = out;

  var files = [];
  try {
    files = fs.readdirSync(path.join(hexo.source_dir, dir));
  } catch (e) {
    return out;
  }

  files.forEach(function (f) {
    if (f.charAt(0) === '.' || f.charAt(0) === '_') return;
    var ext = path.extname(f);
    if (!ASSET_IMAGE_EXT.test(ext)) return;
    var base = f.slice(0, f.length - ext.length);
    var url = (dir ? '/' + dir : '') + '/' + f;
    // 连字符和下划线都认：wechat-qr.jpg 与 wechat_qr.jpg 都能匹配 wechat_qr
    if (!out[base]) out[base] = url;
    var norm = base.replace(/-/g, '_');
    if (norm !== base && !out[norm]) out[norm] = url;
  });

  return out;
}

/**
 * 解析一个个人图片资源，返回可直接写进 src 的 URL。
 * 未命中任何来源时返回空串（调用方据此决定要不要渲染该元素）。
 */
// 取这个资源在配置里的原始值。值可能是 none / false 这类「显式关闭」标记，
// 单看 resolveAsset 的返回值（空串）分不清「关掉了」和「没找到」，所以单独暴露出来。
function assetRawValue(name) {
  var val = '';
  (ASSET_KEYS[name] || ['assets.' + name]).some(function (key) {
    val = configPath(themeConfig(), key);
    return !!val;
  });
  return val;
}

function resolveAsset(name) {
  if (!name) return '';

  var val = assetRawValue(name);

  // 显式关掉：avatar: none
  if (val && ASSET_OFF_VALUES.test(val)) return '';

  // 1) 显式配置：站内路径走 url_for，外链原样返回
  if (val) return isExternalUrl(val) ? val : urlFor(val);

  // 2) 站点 source/<dir>/ 下的同名文件
  var found = scanAssets(assetsDir())[name];
  if (found) return urlFor(found);

  // 3) 站点 source/ 根目录的同名文件。
  //    Hexo 的惯例是 favicon.ico 直接躺在 source 根目录（很多老主题、
  //    老站点都这样），所以要单独认一遍，否则老图标会被主题兜底图顶掉。
  //    按逻辑资源名精确匹配，不会误伤 source 下的其他图片。
  found = scanAssets('')[name];
  if (found) return urlFor(found);

  // 4) 主题内置默认图
  if (!ASSET_FALLBACK[name]) return '';
  return urlFor('/image/' + name.replace(/_/g, '-') + '.svg');
}

hexo.extend.helper.register('theme_asset', function () {
  return resolveAsset(arguments[0]);
});

// 启动时做一次体检：把解析结果和潜在的路径冲突打出来
hexo.extend.filter.register('before_generate', function () {
  var dir = assetsDir();
  if (dir === 'image') {
    hexo.log.warn(
      '[historical] assets.dir 设成了 image，会和主题内置资源 ' +
      'themes/historical/source/image/ 抢同一个 URL；建议换个目录名（默认 assets）'
    );
  }
  ['avatar', 'favicon', 'wechat_qr'].forEach(function (name) {
    var url = resolveAsset(name);
    var raw = assetRawValue(name);
    if (!url && raw && ASSET_OFF_VALUES.test(raw)) {
      // 填了 none / false / off 是「有意关掉」，不是「没找到」。
      // 这种情况不打印的话，用户会以为配置根本没读到。
      hexo.log.info('[historical] ' + name + ' -> 已关闭（配置值 ' + raw + '）');
    } else if (url) {
      hexo.log.info('[historical] ' + name + ' -> ' + url);
    }
  });
});

/* --------------------------------------------------------------- 阅读信息 */

hexo.extend.helper.register('reading_time', function () {
  var text = stripHtml(arguments[0]);
  var count = countWords(text);
  // 中文阅读速度按 400 字/分钟估
  var minutes = Math.max(1, Math.round(count / 400));
  return minutes + ' 分钟';
});

// 字数与时长是同一组信息，模板里按「N 字 · N 分钟」的顺序拼。
// 千位不加分隔符：中文博客里「1234 字」比「1,234 字」更顺眼。
hexo.extend.helper.register('word_count', function () {
  var text = stripHtml(arguments[0]);
  return countWords(text) + ' 字';
});

/* ----------------------------------------------------------------- 分类 */

hexo.extend.helper.register('post_category', function () {
  var post = arguments[0];
  if (!post || !post.categories || !post.categories.length) return null;
  if (typeof post.categories.first === 'function') return post.categories.first();
  var first = null;
  queryToArray(post.categories).some(function (c) { first = c; return true; });
  return first;
});

hexo.extend.helper.register('category_desc', function () {
  var name = arguments[0];
  var raw = dataFile('categories');
  if (!raw) return '';
  if (Array.isArray(raw)) {
    var hit = raw.filter(function (item) { return item && item.name === name; })[0];
    return hit ? (hit.desc || hit.description || '') : '';
  }
  return raw[name] || '';
});

/* ----------------------------------------------------------------- 摘要 */

hexo.extend.helper.register('excerpt_text', function () {
  var post = arguments[0];
  var len = arguments[1] || 96;
  if (!post) return '';
  var text = stripHtml(post.excerpt || post.content || '');
  if (text.length > len) {
    text = text.slice(0, len).replace(/[，。；、,.;:：!！?？\-\s]+$/, '') + '……';
  }
  return text;
});

/* ------------------------------------------------------------- 广告位 */

hexo.extend.helper.register('ad_slot', function () {
  var slot = arguments[0] || 'list_feed';
  var size = arguments[1] || 'inline';

  var cfg = (hexo.theme.config && hexo.theme.config.adsense) || {};
  var client = cfg.client;
  var slotId = (cfg.slots || {})[slot];
  var cls = 'ad-slot ad-slot--' + size;

  // 1) 配了 client + slot id：渲染真实广告单元
  if (client && slotId) {
    return (
      '<div class="' + cls + ' ad-slot--live">' +
        '<ins class="adsbygoogle" style="display:block;width:100%"' +
        ' data-ad-client="' + client + '"' +
        ' data-ad-slot="' + slotId + '"' +
        ' data-ad-format="auto" data-full-width-responsive="true"></ins>' +
      '</div>' +
      '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>'
    );
  }

  // 2) 其余情况：只有在「还没填 client」的调试阶段才画占位框。
  //    一旦填了 client 就绝不画 —— 否则上线后未配置的广告位会露出虚线框。
  if (client || !cfg.placeholder) return '';

  var text = {
    list_feed: '信息流广告位 · 自适应宽度 · 建议 728×90',
    sidebar: '侧栏广告位 · 300×250 · 随侧栏滚动',
    article_bottom: '文末展示广告位 · 自适应宽度'
  }[slot] || '广告位';

  return (
    '<div class="' + cls + '">' +
      '<b>GOOGLE ADSENSE</b>' +
      '<span>' + text + '</span>' +
    '</div>'
  );
});

/* ------------------------------------------------------------- 侧栏计数 */

// 独立博客的条目数。直接复用 blogItems()，保证侧栏数字和页面上
// 实际列出的站点数永远一致（两边各自解析过一次数据时就会对不上）。
function linksCount() {
  return blogItems().length;
}

// 模板里用：独立博客页的站点列表（已归一化）
hexo.extend.helper.register('blog_items', function () {
  return blogItems();
});

hexo.extend.helper.register('links_count', function () {
  return linksCount();
});

hexo.extend.helper.register('sidebar_count', function () {
  var type = arguments[0];
  var posts = hexo.locals.get('posts');
  var categories = hexo.locals.get('categories');
  var tags = hexo.locals.get('tags');

  if (!type) return '';
  if (type === 'posts') return posts ? posts.length : 0;
  if (type === 'categories') return categories ? categories.length : 0;
  if (type === 'tags') return tags ? tags.length : 0;
  if (type === 'links') return linksCount();
  return '';
});

/* --------------------------------------------------------- 按年份分组 */

hexo.extend.helper.register('group_by_year', function () {
  var posts = queryToArray(arguments[0]);
  var map = {};
  var order = [];

  posts.forEach(function (post) {
    if (!post || !post.date) return;
    var year = String(post.date.year ? post.date.year() : post.date.format('YYYY'));
    if (!map[year]) { map[year] = []; order.push(year); }
    map[year].push(post);
  });

  return order.map(function (year) {
    return { year: year, posts: map[year] };
  });
});

/* ------------------------------------------------------------- 过滤器 */

// 正文图片默认懒加载
hexo.extend.filter.register('after_post_render', function (data) {
  if (data.content) {
    data.content = data.content.replace(/<img\b([^>]*)>/gi, function (whole, attrs) {
      if (/\bloading\s*=/.test(attrs)) return whole;
      return '<img' + attrs + ' loading="lazy" decoding="async">';
    });
  }
  return data;
});
