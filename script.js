const RADIUS = 100;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

let MODES = {
  work:       { label: '工作', minutes: 25 },
  shortBreak: { label: '短休息', minutes: 5 },
  longBreak:  { label: '长休息', minutes: 15 }
};

let mode = 'work';
let totalSeconds = MODES[mode].minutes * 60;
let remaining = totalSeconds;
let intervalId = null;
let autoBreak = true;
let autoWork = false;
let soundOn = false;

const STORAGE_KEY = 'pomodoro_data_v1';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getData() {
  const data = loadData() || { records: {}, settings: {}, theme: 'dark' };
  const today = getTodayKey();
  if (!data.records[today]) data.records[today] = [];
  return data;
}

function getTodayRecords() {
  return getData().records[getTodayKey()] || [];
}

function getWeekRecords() {
  const data = getData().records;
  const today = new Date();
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (data[key]) count += data[key].length;
  }
  return count;
}

function addRecord(task, minutes) {
  const data = getData();
  const today = getTodayKey();
  if (!data.records[today]) data.records[today] = [];
  data.records[today].push({
    task: task || '未命名任务',
    minutes: minutes,
    time: new Date().toISOString()
  });
  saveData(data);
  updateStats();
  renderHistory();
}

function updateStats() {
  const today = getTodayRecords();
  const totalMin = today.reduce((s, r) => s + r.minutes, 0);
  document.getElementById('count').textContent = today.length;
  document.getElementById('totalTime').textContent = totalMin + 'm';
  document.getElementById('weekCount').textContent = getWeekRecords();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const records = getTodayRecords().slice().reverse();
  if (records.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无记录</div>';
    return;
  }
  list.innerHTML = records.map(r => {
    const t = new Date(r.time);
    const timeStr = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    return `<div class="history-item"><span class="history-task">${escapeHtml(r.task)}</span><span class="history-time">${timeStr} · ${r.minutes}分钟</span></div>`;
  }).join('');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function saveSettings() {
  const data = getData();
  data.settings = {
    work: MODES.work.minutes,
    shortBreak: MODES.shortBreak.minutes,
    longBreak: MODES.longBreak.minutes,
    autoBreak,
    autoWork
  };
  saveData(data);
}

function loadSettings() {
  const data = getData();
  const s = data.settings;
  if (s) {
    if (s.work) { MODES.work.minutes = s.work; workMinEl.value = s.work; }
    if (s.shortBreak) { MODES.shortBreak.minutes = s.shortBreak; shortBreakMinEl.value = s.shortBreak; }
    if (s.longBreak) { MODES.longBreak.minutes = s.longBreak; longBreakMinEl.value = s.longBreak; }
    if (s.autoBreak !== undefined) { autoBreak = s.autoBreak; toggleEl(toggleAutoBreak, autoBreak); }
    if (s.autoWork !== undefined) { autoWork = s.autoWork; toggleEl(toggleAutoWork, autoWork); }
  }
}

function toggleEl(el, on) {
  if (on) el.classList.add('on');
  else el.classList.remove('on');
}

// Audio
let audioCtx = null;
let noiseNode = null;
let noiseGain = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function createNoiseBuffer() {
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function toggleWhiteNoise() {
  if (soundOn) {
    if (noiseGain) {
      noiseGain.gain.setValueAtTime(noiseGain.gain.value, audioCtx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        if (noiseNode) { noiseNode.stop(); noiseNode.disconnect(); }
        if (noiseGain) noiseGain.disconnect();
        noiseNode = null; noiseGain = null;
      }, 500);
    }
    soundOn = false;
    document.getElementById('btnSound').classList.remove('on');
  } else {
    const ctx = getAudioCtx();
    noiseNode = ctx.createBufferSource();
    noiseNode.buffer = createNoiseBuffer();
    noiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.001;

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseNode.start();
    noiseGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.5);

    soundOn = true;
    document.getElementById('btnSound').classList.add('on');
  }
}

function beep(freq, dur) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq || 880, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (dur || 0.4));
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + (dur || 0.4));
}

function playAlarm() {
  [880, 0, 880, 0, 880].forEach((f, i) => {
    if (f) setTimeout(() => beep(f, 0.35), i * 250);
  });
}

function requestNotification() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, silent: true });
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function updateTitle() {
  document.title = `${formatTime(remaining)} - ${MODES[mode].label}`;
}

function setAccentColor(color, glow) {
  mainCard.style.setProperty('--accent-color', color);
  mainCard.style.setProperty('--accent-glow', glow);
}

function updateDisplay() {
  const timeText = formatTime(remaining);
  timerEl.childNodes[0].textContent = timeText;
  const progress = remaining / totalSeconds;
  barEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  updateTitle();

  timerEl.classList.remove('running', 'break');
  if (intervalId) {
    timerEl.classList.add(mode === 'work' ? 'running' : 'break');
  }

  if (mode === 'work') {
    const color = intervalId ? '#118DFF' : '#D31145';
    const glow = intervalId ? 'rgba(17, 141, 255, 0.3)' : 'rgba(211, 17, 69, 0.3)';
    setAccentColor(color, glow);
    barEl.style.stroke = color;
    if (intervalId) {
      timerLabel.textContent = '专注中';
    } else {
      timerLabel.textContent = '准备开始';
    }
  } else {
    setAccentColor('#10B981', 'rgba(16, 185, 129, 0.3)');
    barEl.style.stroke = '#10B981';
    timerLabel.textContent = '休息中';
  }
}

function updateTabs() {
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  tabs.forEach(t => {
    const m = t.dataset.mode;
    t.querySelector('span').textContent = MODES[m].label + ' ' + MODES[m].minutes + '分钟';
  });
}

function setMode(newMode, autoStarted) {
  mode = newMode;
  totalSeconds = MODES[mode].minutes * 60;
  remaining = totalSeconds;
  stop();
  updateDisplay();
  updateTabs();

  if (autoStarted) startTimer();
}

function startTimer() {
  getAudioCtx();
  if (remaining <= 0) remaining = totalSeconds;
  intervalId = setInterval(tick, 1000);
  updateDisplay();
  btnToggle.textContent = '暂停';
  btnToggle.classList.add('pause');
}

function tick() {
  remaining--;
  updateDisplay();
  if (remaining <= 0) onTimerComplete();
}

function onTimerComplete() {
  stop();
  playAlarm();

  if (mode === 'work') {
    const task = taskInput.value.trim();
    addRecord(task, MODES.work.minutes);
    notify('番茄钟 - 工作完成', task ? `任务完成: ${task}` : '工作时段结束，休息一下吧！');

    if (autoBreak) {
      const next = getTodayRecords().length % 4 === 0 ? 'longBreak' : 'shortBreak';
      setTimeout(() => setMode(next, autoBreak), 1200);
    }
  } else {
    const body = mode === 'shortBreak' ? '短休息结束，继续工作！' : '长休息结束，准备下一轮！';
    notify('番茄钟 - 休息结束', body);
    if (autoWork) setTimeout(() => setMode('work', autoWork), 1200);
  }
}

function stop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function toggleTimer() {
  if (intervalId) {
    stop();
    updateDisplay();
    btnToggle.textContent = '开始';
    btnToggle.classList.remove('pause');
  } else {
    startTimer();
  }
}

function reset() {
  stop();
  remaining = totalSeconds;
  updateDisplay();
  btnToggle.textContent = '开始';
  btnToggle.classList.remove('pause');
}

function skip() {
  stop();
  setMode(mode === 'work' ? 'shortBreak' : 'work', mode === 'work' ? autoBreak : autoWork);
}

function toggleSettings() {
  settingsPanel.classList.toggle('open');
  historyPanel.classList.remove('open');
}

function toggleHistory() {
  historyPanel.classList.toggle('open');
  settingsPanel.classList.remove('open');
}

function updateModeTimes() {
  MODES.work.minutes = parseInt(workMinEl.value) || 25;
  MODES.shortBreak.minutes = parseInt(shortBreakMinEl.value) || 5;
  MODES.longBreak.minutes = parseInt(longBreakMinEl.value) || 15;
  saveSettings();
  if (!intervalId) {
    totalSeconds = MODES[mode].minutes * 60;
    remaining = totalSeconds;
    updateDisplay();
    updateTabs();
  }
}

function toggleSwitch(el, flag) {
  const on = el.classList.toggle('on');
  if (flag === 'autoBreak') autoBreak = on;
  if (flag === 'autoWork') autoWork = on;
  saveSettings();
}

function exportJson() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pomodoro_${getTodayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const data = getData().records;
  let csv = '日期,任务,时长(分钟),完成时间\n';
  Object.keys(data).sort().forEach(date => {
    data[date].forEach(r => {
      csv += `${date},${r.task},${r.minutes},${r.time}\n`;
    });
  });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pomodoro_${getTodayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearData() {
  if (!confirm('确定要清空所有历史记录吗？此操作不可恢复。')) return;
  localStorage.removeItem(STORAGE_KEY);
  updateStats();
  renderHistory();
}

// DOM refs
const timerEl = document.getElementById('timer');
const timerLabel = document.getElementById('timerLabel');
const barEl = document.querySelector('.bar');
const mainCard = document.getElementById('mainCard');
const tabs = document.querySelectorAll('.tab');
const btnToggle = document.getElementById('btnToggle');
const btnReset = document.getElementById('btnReset');
const btnSkip = document.getElementById('btnSkip');
const btnSettings = document.getElementById('btnSettings');
const btnSound = document.getElementById('btnSound');
const settingsPanel = document.getElementById('settingsPanel');
const historyPanel = document.getElementById('historyPanel');
const workMinEl = document.getElementById('workMin');
const shortBreakMinEl = document.getElementById('shortBreakMin');
const longBreakMinEl = document.getElementById('longBreakMin');
const toggleAutoBreak = document.getElementById('toggleAutoBreak');
const toggleAutoWork = document.getElementById('toggleAutoWork');
const taskInput = document.getElementById('taskInput');

// Events
tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

btnToggle.addEventListener('click', () => { requestNotification(); toggleTimer(); });
btnReset.addEventListener('click', reset);
btnSkip.addEventListener('click', skip);
btnSettings.addEventListener('click', toggleSettings);
btnSound.addEventListener('click', toggleWhiteNoise);

toggleAutoBreak.addEventListener('click', () => toggleSwitch(toggleAutoBreak, 'autoBreak'));
toggleAutoWork.addEventListener('click', () => toggleSwitch(toggleAutoWork, 'autoWork'));

[workMinEl, shortBreakMinEl, longBreakMinEl].forEach(el => {
  el.addEventListener('change', updateModeTimes);
});

document.getElementById('btnExportJson').addEventListener('click', exportJson);
document.getElementById('btnExportCsv').addEventListener('click', exportCsv);
document.getElementById('btnClear').addEventListener('click', clearData);

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); requestNotification(); toggleTimer(); }
  if (e.code === 'KeyS') skip();
  if (e.code === 'KeyR') reset();
  if (e.code === 'KeyH') toggleHistory();
});

// Init
barEl.style.strokeDasharray = CIRCUMFERENCE;
barEl.style.strokeDashoffset = '0';
loadSettings();
updateTabs();
updateDisplay();
updateStats();
renderHistory();
