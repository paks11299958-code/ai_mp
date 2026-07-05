/* 🔌 AI PERSONAS 임베드 위젯 (2026-07-06)
 * 사용법(외부 사이트에 한 줄):
 *   <script src="https://aichat.dbzone.kr/widget.js" data-persona="유나" data-color="#8E6FB7" async></script>
 * data-persona: 페르소나 이름 또는 id (필수) / data-color: 버튼 색(선택)
 * 동작: 우하단 플로팅 버튼 → 클릭 시 iframe 모달(aichat.dbzone.kr/?embed=…)
 */
(function () {
    var script = document.currentScript;
    if (!script) return;
    var persona = script.getAttribute('data-persona');
    if (!persona) { console.warn('[aichat-widget] data-persona 필요'); return; }
    var color = script.getAttribute('data-color') || '#8E6FB7';
    var ORIGIN = 'https://aichat.dbzone.kr';

    var btn = document.createElement('button');
    btn.innerHTML = '💬';
    btn.setAttribute('aria-label', 'AI 채팅 열기');
    btn.style.cssText = 'position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;' +
        'border:none;cursor:pointer;font-size:24px;z-index:2147483000;color:#fff;background:' + color + ';' +
        'box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s;';
    btn.onmouseenter = function () { btn.style.transform = 'scale(1.08)'; };
    btn.onmouseleave = function () { btn.style.transform = 'none'; };

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;right:20px;bottom:88px;width:380px;max-width:calc(100vw - 32px);' +
        'height:600px;max-height:calc(100vh - 120px);z-index:2147483000;display:none;' +
        'border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.3);background:#fff;';
    var iframe = document.createElement('iframe');
    iframe.src = ORIGIN + '/?embed=' + encodeURIComponent(persona);
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.allow = 'clipboard-write';
    wrap.appendChild(iframe);

    var open = false;
    btn.onclick = function () {
        open = !open;
        wrap.style.display = open ? 'block' : 'none';
        btn.innerHTML = open ? '✕' : '💬';
    };

    document.body.appendChild(btn);
    document.body.appendChild(wrap);
})();
