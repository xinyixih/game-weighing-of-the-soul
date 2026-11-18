/* 读心冠 · 阶段 2 犹豫判定测试 — 程序 */

/* ===================== 常量 ===================== */
const FS = 256;
const CH = ['TP9', 'AF7', 'AF8', 'TP10'];
const MUSE_SERVICE = 0xfe8d;
const U = s => `273e${s}-4c4d-454d-96be-f03bac821358`;
const CONTROL_UUID = U('0001');
const TELEMETRY_UUID = U('000b');
const EEG_UUIDS = [U('0003'), U('0004'), U('0005'), U('0006')];
const BLINK_THR = 90;

/* ===================== 工具 ===================== */
const $ = id => document.getElementById(id);
const now = () => performance.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function log(msg){
    $('log').insertAdjacentHTML('beforeend', `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`);
    $('log').scrollTop = 1e9;
}
function shuffle(arr){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
function stamp(){
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function download(name, text){
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });  // BOM：Excel 打开中文不乱码
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    log('已导出 ' + name);
}
const csvCell = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* ===================== EEG 部分（与阶段 0/1 测试页相同） ===================== */
class Ring {
    constructor(n){ this.buf = new Float32Array(n); this.n = n; this.i = 0; this.count = 0; }
    push(v){ this.buf[this.i] = v; this.i = (this.i + 1) % this.n; this.count++; }
    last(k){ k = Math.min(k, this.n, this.count); const o = new Float32Array(k);
        for (let j = 0; j < k; j++) o[j] = this.buf[(this.i - k + j + this.n) % this.n]; return o; }
}
const rings = CH.map(() => new Ring(FS * 4));
let eegMode = null, device = null, controlChar = null;
let pending = new Map(), lastIndex = null, lostPackets = 0;
let eegRecording = false, eegStart = null, eegRows = [], nextMarker = '';
let blinkBase = 0, blinkUntil = 0, blinkFlag = 0;

function encodeCommand(cmd){ const e = new TextEncoder().encode(`X${cmd}\n`); e[0] = e.length - 1; return e; }
async function sendCommand(cmd){
    if (!controlChar) return;
    const d = encodeCommand(cmd);
    if (controlChar.writeValueWithoutResponse) { try { await controlChar.writeValueWithoutResponse(d); return; } catch (e) {} }
    await controlChar.writeValue(d);
}
function decodeEEG(dv){
    const index = dv.getUint16(0);
    const b = new Uint8Array(dv.buffer, dv.byteOffset + 2, dv.byteLength - 2);
    const raw = [];
    for (let i = 0; i < b.length; i++) {
        if (i % 3 === 0) raw.push((b[i] << 4) | (b[i + 1] >> 4));
        else { raw.push(((b[i] & 0x0f) << 8) | b[i + 1]); i++; }
    }
    return { index, samples: raw.map(n => 0.48828125 * (n - 0x800)) };
}
async function connectMuse(){
    if (!('bluetooth' in navigator)) { log('此浏览器不支持 Web Bluetooth，请用 Chrome 或 Edge'); return; }
    try {
        setConn('选择设备…', 'warn');
        device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'Muse' }], optionalServices: [MUSE_SERVICE] });
        device.addEventListener('gattserverdisconnected', () => {
            if (eegMode === 'muse') { log('⚠ 头环断开了'); eegMode = null; setConn('已断开', 'err'); setButtons(); }
        });
        setConn('连接中…', 'warn');
        const service = await (await device.gatt.connect()).getPrimaryService(MUSE_SERVICE);
        controlChar = await service.getCharacteristic(CONTROL_UUID);
        try {
            const tele = await service.getCharacteristic(TELEMETRY_UUID);
            await tele.startNotifications();
            tele.addEventListener('characteristicvaluechanged', e => { $('battery').textContent = (e.target.value.getUint16(2) / 512).toFixed(0) + '%'; });
        } catch (e) {}
        for (let c = 0; c < 4; c++) {
            const ch = await service.getCharacteristic(EEG_UUIDS[c]);
            await ch.startNotifications();
            ch.addEventListener('characteristicvaluechanged', e => { const r = decodeEEG(e.target.value); onChannelPacket(c, r.index, r.samples); });
        }
        await sendCommand('h'); await sendCommand('p21'); await sendCommand('s'); await sendCommand('d');
        eegMode = 'muse'; resetStream();
        setConn(device.name || 'Muse', 'ok'); setButtons();
        log('已连接 ' + (device.name || 'Muse'));
    } catch (e) { setConn('未连接', 'err'); log('连接失败：' + e.message); }
}
async function disconnect(){
    if (eegMode === 'muse' && device) { try { await sendCommand('h'); } catch (e) {} try { device.gatt.disconnect(); } catch (e) {} }
    if (eegMode === 'sim') clearInterval(simTimer);
    eegMode = null; setConn('未连接', ''); setButtons();
}
function setConn(text, cls){ $('chipConn').className = 'chip ' + (cls || ''); $('chipConn').querySelector('b').textContent = text; }
function setButtons(){
    const busy = !!(session && session.running);
    $('btnConnect').disabled = !!eegMode || busy;
    $('btnSim').disabled = !!eegMode || busy;
    $('btnDisconnect').disabled = !eegMode || busy;
    $('setupNote').textContent = eegMode
        ? '头环已连接。确认信号质量后即可开始。'
        : '可以不连头环直接开始，此时只记录行为数据（用于试测题目）。';
}
function resetStream(){ pending.clear(); lastIndex = null; lostPackets = 0; $('lost').textContent = '0'; }
function onChannelPacket(c, index, samples){
    const t = now();
    let e = pending.get(index);
    if (!e) { e = { t, ch: [null, null, null, null] }; pending.set(index, e); }
    e.ch[c] = samples;
    if (e.ch.every(Boolean)) { pending.delete(index); emitPacket(index, e); }
    if (pending.size > 20) for (const [k, v] of pending) if (t - v.t > 1000) pending.delete(k);
}
function emitPacket(index, e){
    if (lastIndex !== null) {
        const gap = (index - lastIndex + 0x10000) % 0x10000;
        if (gap > 1 && gap < 1000) { lostPackets += gap - 1; $('lost').textContent = lostPackets; }
    }
    lastIndex = index;
    for (let k = 0; k < 12; k++) {
        const t = e.t - (11 - k) * (1000 / FS);
        const v = [e.ch[0][k], e.ch[1][k], e.ch[2][k], e.ch[3][k]];
        for (let c = 0; c < 4; c++) rings[c].push(v[c]);
        const fp = (v[1] + v[2]) / 2;
        blinkBase += (fp - blinkBase) / FS;
        if (Math.abs(fp - blinkBase) > BLINK_THR && t > blinkUntil) { blinkUntil = t + 350; blinkFlag = 1; }
        if (eegRecording) {
            if (eegStart === null) eegStart = t;
            eegRows.push([(t - eegStart).toFixed(1), index, v[0].toFixed(2), v[1].toFixed(2), v[2].toFixed(2), v[3].toFixed(2), nextMarker, blinkFlag]);
            nextMarker = ''; blinkFlag = 0;
        }
    }
}

/* 模拟模式：犹豫时（决策窗口）让额叶 θ 稍微升高，方便检查分析流程 */
let simTimer = null, simHesitate = false;
function gauss(){ let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function startSim(){
    eegMode = 'sim'; resetStream();
    let idx = 0, t = 0, nextBlink = 2, blinkAt = -10;
    const ph = [0, 1, 2, 3].map(() => Math.random() * 6.28);
    simTimer = setInterval(() => {
        const pk = [[], [], [], []];
        for (let k = 0; k < 12; k++) {
            t += 1 / FS;
            if (t > nextBlink) { blinkAt = t; nextBlink = t + 2 + Math.random() * 4; }
            const blink = 160 * Math.exp(-Math.pow((t - blinkAt - 0.1) / 0.06, 2));
            for (let c = 0; c < 4; c++) {
                const front = c === 1 || c === 2;
                const theta = front ? (simHesitate ? 12 : 5) : 3;
                let x = 7 * gauss() + 6 * Math.sin(2 * Math.PI * 10 * t + ph[c]) + theta * Math.sin(2 * Math.PI * 6 * t + ph[c] * 2);
                if (front) x += blink;
                pk[c].push(x);
            }
        }
        idx = (idx + 1) % 0x10000;
        for (let c = 0; c < 4; c++) onChannelPacket(c, idx, pk[c]);
    }, 1000 * 12 / FS);
    setConn('模拟模式', 'warn'); setButtons();
    log('已进入模拟模式（数据是合成的）');
}

/* 信号质量（与测试页相同的估算方法） */
function quality(seg){
    let m = 0, mx = 0; for (const v of seg) { m += v; mx = Math.max(mx, Math.abs(v)); } m /= seg.length;
    let sd = 0; for (const v of seg) sd += (v - m) ** 2; sd = Math.sqrt(sd / seg.length);
    if (mx > 900 || sd < 1 || sd > 80) return 'bad';
    return sd <= 30 ? 'good' : 'fair';
}
(function buildQuality(){
    for (const id of ['quality', 'qualityMini'])
        $(id).innerHTML = CH.map((n, c) => `<span class="q" title="${n}"><i id="${id}${c}"></i>${id === 'quality' ? n : ''}</span>`).join('');
})();
setInterval(() => {
    for (let c = 0; c < 4; c++) {
        const q = eegMode && rings[c].count >= FS ? quality(rings[c].last(FS)) : 'none';
        for (const id of ['quality', 'qualityMini']) $(id + c).className = q;
    }
}, 500);

/* ===================== 实验流程 ===================== */
let session = null;     // 当前被试的全部数据
let keyWaiter = null;   // 当前等待的按键
let aborted = false;

function mark(tag){
    const t = now();
    if (session) session.events.push({ t, tag });
    if (eegRecording) nextMarker = nextMarker ? nextMarker + '|' + tag : tag;
    return t;
}
function waitKey(keys){
    return new Promise((resolve, reject) => { keyWaiter = { keys, resolve, reject }; });
}
function pressKey(k){
    if (!keyWaiter || !keyWaiter.keys.includes(k)) return;
    const w = keyWaiter; keyWaiter = null;
    w.resolve({ key: k, t: now() });
}
document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
    pressKey(e.key.toLowerCase());
});
document.addEventListener('click', e => {
    const b = e.target.closest('[data-key]');
    if (b) pressKey(b.dataset.key);
});
async function step(ms){ await sleep(ms); if (aborted) throw new Error('aborted'); }

function show(id){
    for (const s of ['scrSetup', 'scrMsg', 'scrTrial', 'scrEnd']) $(s).classList.toggle('hidden', s !== id);
}
function message(title, body, hint){
    show('scrMsg');
    $('msgTitle').textContent = title; $('msgBody').innerHTML = body; $('msgHint').innerHTML = hint || '';
}
async function waitSpace(){ const r = await waitKey([' ', 'enter']); if (aborted) throw new Error('aborted'); return r; }

async function startExperiment(){
    const set = $('set').value, n = +$('nItems').value;
    const pool = BANK.filter(it => it.id[0] === set);
    // 按象限分层抽题，保证每个象限数量相同
    const quads = ['Q1', 'Q2', 'Q3', 'Q4'];
    let picked = [];
    for (const q of quads) picked = picked.concat(shuffle(pool.filter(it => it.q === q)).slice(0, Math.max(1, n / 4)));
    session = {
        pid: $('pid').value.trim() || 'P00', set,
        settings: { n, base: +$('baseLen').value, practice: +$('practice').value, reveal: +$('reveal').value },
        items: shuffle(picked), trials: [], events: [], eeg: !!eegMode, eegMode,
        startedAt: new Date().toISOString(), running: true
    };
    aborted = false;
    setButtons();
    $('topbar').classList.add('hidden'); $('miniStatus').classList.remove('hidden'); $('logWrap').classList.add('hidden');
    $('miniText').textContent = eegMode ? '录制中' : '仅行为数据';
    if (eegMode) { eegRows = []; eegStart = null; eegRecording = true; }
    session.t0 = mark('session_start');
    log(`开始：${session.pid} · ${set} 套 · ${session.items.length} 题 · ${eegMode ? 'EEG ' + eegMode : '无 EEG'}`);

    try {
        // 说明
        message('欢迎',
            `<p>接下来你会看到一系列判断题。每道题：</p>
              <ol><li>先判断这句话是<b>对</b>还是<b>错</b></li>
              <li>然后 AI 会给出它的看法</li>
              <li>你再决定<b>改不改</b>自己的答案</li>
              <li>最后回答两个小问题</li></ol>
              <p>请把左手食指放在 <kbd>F</kbd>、右手食指放在 <kbd>J</kbd>。答题时尽量保持身体不动、不说话。</p>
              <p class="note">AI 的说法不一定正确。</p>`,
            '按 <kbd>空格</kbd> 继续');
        await waitSpace();

        // 静息基线
        if (session.settings.base > 0) {
            message('静息基线', '<p>请放松，看着屏幕中央的 <b>+</b>，尽量不眨眼、不动。</p>', '按 <kbd>空格</kbd> 开始');
            await waitSpace();
            show('scrTrial'); $('trialBody').classList.add('hidden'); $('fix').classList.remove('hidden');
            $('counter').textContent = '静息基线'; $('progBar').style.width = '0';
            mark('baseline_start');
            await step(session.settings.base * 1000);
            mark('baseline_end');
            $('fix').classList.add('hidden');
        }

        // 练习
        if (session.settings.practice) {
            message('练习', '<p>先做 3 道练习题，熟悉操作。练习不计入结果。</p>', '按 <kbd>空格</kbd> 开始');
            await waitSpace();
            for (let i = 0; i < PRACTICE.length; i++) session.trials.push(await runTrial(PRACTICE[i], i + 1, PRACTICE.length, true));
            message('练习结束', '<p>接下来是正式题目。</p>', '按 <kbd>空格</kbd> 开始');
            await waitSpace();
        }

        // 正式题
        for (let i = 0; i < session.items.length; i++) {
            if (i > 0 && i % 20 === 0) {
                mark('break_start');
                message('休息一下', `<p>已完成 ${i} / ${session.items.length} 题。</p><p>可以活动一下，准备好后继续。</p>`, '按 <kbd>空格</kbd> 继续');
                await waitSpace();
                mark('break_end');
            }
            session.trials.push(await runTrial(session.items[i], i + 1, session.items.length, false));
        }
        finish(false);
    } catch (e) {
        if (e.message !== 'aborted') { log('出错：' + e.message); console.error(e); }
        finish(true);
    }
}

async function runTrial(item, n, total, practice){
    const tag = (practice ? 'P' : 'T') + String(n).padStart(2, '0') + ':' + item.id;
    show('scrTrial');
    $('counter').textContent = practice ? `练习 ${n} / ${total}` : `第 ${n} / ${total} 题`;
    $('progBar').style.width = practice ? '0' : `${(n - 1) / total * 100}%`;

    // 注视点
    $('trialBody').classList.add('hidden'); $('fix').classList.remove('hidden');
    mark(tag + ':fix');
    await step(1000 + Math.random() * 500);
    $('fix').classList.add('hidden');

    // 出题 + 初答
    for (const id of ['aiBox', 'choices2', 'rating1', 'rating2', 'revealBox']) $(id).classList.add('hidden');
    $('choices1').classList.remove('hidden');
    $('choices1').querySelectorAll('.choice').forEach(b => b.classList.remove('picked'));
    $('statement').textContent = item.s;
    $('trialBody').classList.remove('hidden');
    const tQ = mark(tag + ':q_onset');
    const r1 = await waitKey(['f', 'j']);
    const ans1 = r1.key === 'f' ? 1 : 0;
    mark(tag + ':answer1');
    $('choices1').querySelector(`[data-key="${r1.key}"]`).classList.add('picked');

    // AI 思考 + AI 说法
    const aiVerdict = item.aiOk ? item.a : 1 - item.a;
    $('aiBox').classList.remove('hidden');
    $('aiBox').classList.add('thinking');
    $('aiVerdict').textContent = 'AI 正在分析…'; $('aiText').textContent = '';
    await step(900 + Math.random() * 600);
    $('aiBox').classList.remove('thinking');
    $('aiVerdict').innerHTML = `AI 认为这句话是 <b>${aiVerdict ? '对' : '错'}</b> 的`;
    $('aiText').textContent = item.ai;
    $('choices1').classList.add('hidden');
    $('choices2').classList.remove('hidden');
    const tAI = mark(tag + ':ai_onset');      // 决策窗口开始
    if (eegMode === 'sim') simHesitate = true;

    // 改 / 不改
    const r2 = await waitKey(['f', 'j']);
    if (eegMode === 'sim') simHesitate = false;
    const changed = r2.key === 'j' ? 1 : 0;
    const final = changed ? 1 - ans1 : ans1;
    const tD = mark(tag + ':decide');         // 决策窗口结束
    $('choices2').classList.add('hidden');

    // 自评
    $('rating1').classList.remove('hidden');
    const r3 = await waitKey(['1', '2', '3', '4']);
    mark(tag + ':confidence');
    $('rating1').classList.add('hidden');
    $('rating2').classList.remove('hidden');
    const r4 = await waitKey(['1', '2', '3']);
    mark(tag + ':prior');
    $('rating2').classList.add('hidden');

    // 揭晓
    if (session.settings.reveal) {
        $('aiBox').classList.add('hidden');
        const ok = final === item.a;
        $('revealBox').innerHTML = `正确答案：<b>${item.a ? '对' : '错'}</b>　·　你的答案：<b class="${ok ? 'good' : 'bad'}">${ok ? '答对了' : '答错了'}</b>`;
        $('revealBox').classList.remove('hidden');
        mark(tag + ':reveal');
        await step(1800);
    }
    await step(400);

    return {
        practice: practice ? 1 : 0, trial: n, item_id: item.id, quadrant: item.q, statement: item.s,
        correct: item.a, ai_verdict: aiVerdict, ai_correct: item.aiOk,
        answer1: ans1, answer1_correct: ans1 === item.a ? 1 : 0, rt1_ms: (r1.t - tQ).toFixed(0),
        changed, final, final_correct: final === item.a ? 1 : 0, followed_ai: final === aiVerdict ? 1 : 0,
        rt2_ms: (r2.t - tAI).toFixed(0), confidence: +r3.key, prior: ['', '知道', '不确定', '不知道'][+r4.key],
        t_q_onset: tQ, t_ai_onset: tAI, t_decide: tD
    };
}

function finish(wasAborted){
    mark(wasAborted ? 'session_abort' : 'session_end');
    session.running = false;
    eegRecording = false;
    keyWaiter = null;
    $('topbar').classList.remove('hidden'); $('miniStatus').classList.add('hidden'); $('logWrap').classList.remove('hidden');
    show('scrEnd');
    const real = session.trials.filter(t => !t.practice);
    const changedN = real.filter(t => t.changed).length;
    const correctN = real.filter(t => t.final_correct).length;
    $('endSummary').innerHTML = `${wasAborted ? '<b class="bad">实验被中止。</b>' : ''}被试 <b>${session.pid}</b> · ${session.set} 套 · 完成 ${real.length} 题 · 改答案 ${changedN} 次 · 最终答对 ${correctN} 题` +
        (session.eeg ? ` · EEG ${(eegRows.length / FS).toFixed(0)} 秒，丢包 ${lostPackets}` : ' · 未记录 EEG');
    $('btnExportEEG').disabled = !session.eeg || !eegRows.length;
    $('debrief').querySelector('tbody').innerHTML = real.map((t, i) =>
        `<tr class="${t.ai_correct ? '' : 'aiwrong'}"><td>${i + 1}</td><td>${t.statement}</td><td>${t.correct ? '对' : '错'}</td>` +
        `<td>${t.ai_correct ? '对' : '<b>AI 说错了</b>'}</td><td>${t.final ? '对' : '错'}</td></tr>`).join('');
    log(`结束：完成 ${real.length} 题${wasAborted ? '（中止）' : ''}`);
    setButtons();
}

/* ===================== 导出 ===================== */
function exportTrials(){
    const s = session, base = eegStart ?? s.t0;
    const cols = ['participant', 'set', 'eeg_mode', 'practice', 'trial', 'item_id', 'quadrant', 'statement', 'correct', 'ai_verdict', 'ai_correct',
        'answer1', 'answer1_correct', 'rt1_ms', 'changed', 'final', 'final_correct', 'followed_ai', 'rt2_ms', 'confidence', 'prior',
        'q_onset_ms', 'ai_onset_ms', 'decide_ms'];
    const rows = s.trials.map(t => [s.pid, s.set, s.eegMode || 'none', t.practice, t.trial, t.item_id, t.quadrant, t.statement, t.correct, t.ai_verdict, t.ai_correct,
        t.answer1, t.answer1_correct, t.rt1_ms, t.changed, t.final, t.final_correct, t.followed_ai, t.rt2_ms, t.confidence, t.prior,
        (t.t_q_onset - base).toFixed(1), (t.t_ai_onset - base).toFixed(1), (t.t_decide - base).toFixed(1)]);
    download(`${s.pid}_${s.set}_trials_${stamp()}.csv`, [cols, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n');
    s.exportedTrials = true;
}
function exportEEG(){
    const head = 'time_ms,packet_index,TP9,AF7,AF8,TP10,marker,blink_auto';
    download(`${session.pid}_${session.set}_eeg_${stamp()}.csv`, head + '\n' + eegRows.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
    session.exportedEEG = true;
}
window.addEventListener('beforeunload', e => {
    if (session && session.trials.length && !session.exportedTrials) { e.preventDefault(); e.returnValue = ''; }
});

/* ===================== 按钮 ===================== */
$('btnConnect').onclick = connectMuse;
$('btnSim').onclick = startSim;
$('btnDisconnect').onclick = disconnect;
$('btnStart').onclick = () => { if (!session) startExperiment(); };
$('btnAbort').onclick = () => {
    if (!confirm('确定中止实验吗？已完成的题目数据会保留。')) return;
    aborted = true;
    if (keyWaiter) { const w = keyWaiter; keyWaiter = null; w.reject(new Error('aborted')); }
};
$('btnExportTrials').onclick = exportTrials;
$('btnExportEEG').onclick = exportEEG;
$('btnRestart').onclick = () => {
    if (session && !session.exportedTrials && !confirm('行为数据还没导出，确定开始新的被试吗？')) return;
    session = null; eegRows = []; show('scrSetup'); setButtons();
    const m = $('pid').value.match(/^(\D*)(\d+)$/);
    if (m) $('pid').value = m[1] + String(+m[2] + 1).padStart(m[2].length, '0');
};
setButtons();
log('页面已就绪');