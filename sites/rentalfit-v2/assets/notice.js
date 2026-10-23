/* 홈 진입 안내 모달 — 렌탈 파트너 모집 (2026-10-23)
 * 하루에 한 번만 보인다(기기 저장). 닫기 ✕·바깥 누름·Esc·닫기 버튼. 외부 요청 없음. */
(function () {
  'use strict';
  var KEY = 'rentalfit-partner-notice-closed-at';
  var DAY = 24 * 60 * 60 * 1000;

  function closedRecently() {
    try {
      var at = Number(localStorage.getItem(KEY) || 0);
      return at > 0 && Date.now() - at < DAY;
    } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* 비공개 창 등 — 그냥 닫는다 */ }
  }

  function build() {
    var overlay = document.createElement('div');
    overlay.className = 'notice-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'notice-title');
    overlay.innerHTML =
      '<div class="notice-card">' +
        '<button type="button" class="notice-close" aria-label="안내 닫기">×</button>' +
        '<span class="notice-eyebrow">렌탈 파트너 모집</span>' +
        '<h2 id="notice-title">우리 집에서 시작하는 렌탈 부업</h2>' +
        '<p>가입비·물품 구매 없이, 앱과 영상교육으로 시작하는 렌탈 상담 파트너를 모집합니다.</p>' +
        '<div class="notice-actions">' +
          '<a class="btn" href="partner/">자세히 보기</a>' +
          '<button type="button" class="btn btn-ghost" data-notice-close>닫기</button>' +
        '</div>' +
      '</div>';
    return overlay;
  }

  var FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function show() {
    var overlay = build();
    var previous = document.activeElement;
    // 보인 시각을 바로 기록한다 — 닫지 않고 새로고침해도 하루(24시간) 동안 다시 뜨지 않는다(검수 2026-10-23).
    remember();
    // 뒤 화면은 비활성(inert), 초점은 안내창 안에서만 돈다.
    var backdrop = [].slice.call(document.body.children).filter(function (el) {
      return el !== overlay && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK';
    }).map(function (el) { var was = el.inert; el.inert = true; return [el, was]; });
    function close() {
      overlay.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      backdrop.forEach(function (p) { p[0].inert = p[1]; });
      window.setTimeout(function () { overlay.remove(); }, 250);
      if (previous && previous.focus) previous.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var els = [].slice.call(overlay.querySelectorAll(FOCUSABLE));
      if (!els.length) return;
      var first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('.notice-close, [data-notice-close]')) close();
    });
    overlay.querySelector('.btn').addEventListener('click', remember);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    window.requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      overlay.querySelector('.btn').focus();
    });
  }

  function start() {
    if (closedRecently()) return;
    window.setTimeout(show, 700);   // 첫 화면이 먼저 보이고 난 뒤
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
