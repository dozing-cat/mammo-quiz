let QUESTION_BANK = [];

const STORAGE_KEY = 'mammo-quiz-state-v1';

function makeInitialState() {
  return {
    currentCategory: 'all',
    statsById: {},
    wrongIds: [],
    flaggedIds: [],
    bookmarkedIds: [],
    questions: [],
    pool: [],
    base: [],
    currentSessionIds: [],
    sessionSize: 10,
    index: 0,
    correct: 0,
    answered: 0,
    locked: false,
    view: 'quiz'
  };
}

function normalizeState(raw) {
  const base = makeInitialState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    currentCategory: typeof raw.currentCategory === 'string' ? raw.currentCategory : 'all',
    statsById: raw.statsById && typeof raw.statsById === 'object' ? raw.statsById : {},
    wrongIds: Array.isArray(raw.wrongIds) ? raw.wrongIds : [],
    flaggedIds: Array.isArray(raw.flaggedIds) ? raw.flaggedIds : [],
    bookmarkedIds: Array.isArray(raw.bookmarkedIds) ? raw.bookmarkedIds : []
  };
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeInitialState();
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    return makeInitialState();
  }
}

function saveState() {
  try {
    const payload = {
      currentCategory: state.currentCategory,
      statsById: state.statsById,
      wrongIds: state.wrongIds,
      flaggedIds: state.flaggedIds,
      bookmarkedIds: state.bookmarkedIds
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

const state = Object.assign(makeInitialState(), loadPersistedState());
const app = document.getElementById('app');
const masteryLabel = document.getElementById('masteryLabel');
const overallMastery = document.getElementById('overallMastery');
const clearedCount = document.getElementById('clearedCount');
const categorySelect = document.getElementById('categorySelect');
const restartBtn = document.getElementById('restartBtn');
const retryWrongBtn = document.getElementById('retryWrongBtn');
const masteryPageBtn = document.getElementById('masteryPageBtn');
const savedToggleBtn = document.getElementById('savedToggleBtn');
const savedPanel = document.getElementById('savedPanel');
const bookmarkPageBtn = document.getElementById('bookmarkPageBtn');
const flaggedPageBtn = document.getElementById('flaggedPageBtn');

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleChoicesPerRender(questions) {
  return questions.map(q => {
    const indexed = q.choices.map((c, i) => ({ text: c, isCorrect: i === q.answer_index }));
    const mixed = shuffle(indexed);
    return {
      ...q,
      choices: mixed.map(x => x.text),
      answer_index: mixed.findIndex(x => x.isCorrect)
    };
  });
}

function buildCategories() {
  const cats = ['all', ...new Set(QUESTION_BANK.map(q => q.category))];
  categorySelect.innerHTML = cats.map(c => `<option value="${c}">${c === 'all' ? '全カテゴリ' : c}</option>`).join('');
}

function buildPool() {
  if (state.currentCategory === 'all') return [...QUESTION_BANK];
  return QUESTION_BANK.filter(q => q.category === state.currentCategory);
}

function weightedPick(pool, count) {
  const available = [...pool];
  const picked = [];
  while (available.length && picked.length < count) {
    const weights = available.map(q => {
      const s = state.statsById[q.id] || { seen: 0, wrong: 0, mastery: 0 };
      const mastery = s.mastery || 0;
      const inSelectedCategory = state.currentCategory === 'all' || q.category === state.currentCategory;
      const wrongBoost = inSelectedCategory ? 4 : 2;
      const masteryWeightMap = [6, 4, 2, 0.8];
      const masteryWeight = masteryWeightMap[Math.max(0, Math.min(3, mastery))];
      return masteryWeight + s.wrong * wrongBoost + Math.max(0, s.seen * 0.05);
    });
    const total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i=0;i<available.length;i++) {
      r -= weights[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(available[idx]);
    available.splice(idx,1);
  }
  return picked;
}

function prepareQuestions(mode = 'all') {
  let src = buildPool();
  if (mode === 'wrong') {
    const wrongSet = new Set(state.wrongIds);
    src = src.filter(q => wrongSet.has(q.id));
  }
  state.base = src;
  state.pool = src;
  const selected = weightedPick(src, state.sessionSize);
  state.currentSessionIds = selected.map(q => q.id);
  state.questions = shuffleChoicesPerRender(selected);
  state.index = 0;
  state.correct = 0;
  state.answered = 0;
  state.locked = false;
  updateStats();
  render();
}

function updateStats() {
  const targetItems = state.currentCategory === 'all' ? QUESTION_BANK : QUESTION_BANK.filter(q => q.category === state.currentCategory);
  const totalQuestions = targetItems.length;
  const masterySum = targetItems.reduce((sum, q) => {
    const s = state.statsById[q.id] || { mastery: 0 };
    return sum + Math.max(0, Math.min(3, s.mastery || 0));
  }, 0);
  const masteryPct = totalQuestions ? Math.round((masterySum / (totalQuestions * 3)) * 100) : 0;
  const cleared = targetItems.filter(q => ((state.statsById[q.id] || {}).mastery || 0) >= 3).length;
  const label = state.currentCategory === 'all' ? '習熟度' : `${state.currentCategory} の習熟度`;
  if (masteryLabel) masteryLabel.textContent = label;
  if (overallMastery) overallMastery.textContent = `${masteryPct}%`;
  if (clearedCount) clearedCount.textContent = cleared;
  retryWrongBtn.disabled = state.wrongIds.length === 0;
}

function toggleBookmarkCurrent() {
  const q = state.questions[state.index];
  if (!q) return;
  if (state.bookmarkedIds.includes(q.id)) {
    state.bookmarkedIds = state.bookmarkedIds.filter(id => id !== q.id);
  } else {
    state.bookmarkedIds.unshift(q.id);
  }
  saveState();
  const bookmarkBtn = document.querySelector('.issue-actions button:nth-child(1)');
  if (bookmarkBtn) {
    if (state.bookmarkedIds.includes(q.id)) {
      bookmarkBtn.classList.add('active-flag');
    } else {
      bookmarkBtn.classList.remove('active-flag');
    }
  }
}

function removeBookmark(id) {
  state.bookmarkedIds = state.bookmarkedIds.filter(x => x !== id);
  saveState();
  renderBookmarks();
}

function renderBookmarks() {
  state.view = 'bookmarks';
  const items = state.bookmarkedIds.map(id => QUESTION_BANK.find(q => q.id === id)).filter(Boolean);
  app.innerHTML = `
    <div class="result">
      <span class="pill">ブックマーク</span>
      <h2>ブックマークした問題</h2>
      ${items.length ? `
        <div class="bookmark-list" style="display:grid; gap:10px; margin-top:14px; text-align:left; font-size:13px;">
          ${items.map(q => `
            <div class="choice" style="display:block; padding:12px;">
              <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:8px;">
                <div>
                  <div style="font-size:11px; color:var(--muted); margin-bottom:4px;">${q.id}｜${q.category}</div>
                  <div style="font-weight:700; margin-bottom:8px;">${q.question}</div>
                </div>
                <button class="secondary" style="font-size:12px; padding:6px 8px; min-height:32px;" onclick="removeBookmark('${q.id}')">解除</button>
              </div>
              <div style="font-size:12px; color:var(--muted);">${q.choices.map((c, i) => `${String.fromCharCode(65+i)}. ${c}`).join(' ／ ')}</div>
            </div>
          `).join('')}
        </div>
      ` : '<p style="margin-top:12px; color:var(--muted);">ブックマークはありません</p>'}
      <div class="footer" style="justify-content:center; margin-top:18px;">
        <button onclick="backToQuiz()">戻る</button>
      </div>
    </div>`;
}

function toggleFlagCurrent() {
  const q = state.questions[state.index];
  if (!q) return;
  const pos = state.flaggedIds.indexOf(q.id);
  if (pos >= 0) {
    state.flaggedIds.splice(pos, 1);
  } else {
    state.flaggedIds.push(q.id);
  }
  saveState();
  updateStats();
  const flagBtn = document.querySelector('.issue-actions button:nth-child(2)');
  if (flagBtn) {
    if (state.flaggedIds.includes(q.id)) {
      flagBtn.classList.add('active-flag');
    } else {
      flagBtn.classList.remove('active-flag');
    }
  }
}

function calcMastery(question) {
  const s = state.statsById[question.id] || { mastery: 0 };
  return Math.max(0, Math.min(100, Math.round(((s.mastery || 0) / 3) * 100)));
}

function categoryMasteryRows() {
  const categories = [...new Set(QUESTION_BANK.map(q => q.category))];
  return categories.map(category => {
    const items = QUESTION_BANK.filter(q => q.category === category);
    const percents = items.map(calcMastery);
    const avg = items.length ? Math.round(percents.reduce((a, b) => a + b, 0) / items.length) : 0;
    const cleared = items.filter(q => calcMastery(q) >= 100).length;
    const untouched = items.filter(q => !(state.statsById[q.id]?.seen)).length;
    return { category, total: items.length, avg, cleared, untouched };
  });
}

function openMasteryPage() {
  state.view = 'mastery';
  render();
}

function buildFlaggedLineText() {
  const flagged = QUESTION_BANK.filter(q => state.flaggedIds.includes(q.id));
  if (!flagged.length) return '違和感ありはありません';
  return ['違和感あり', ...flagged.map(q => `${q.id}｜${q.category}｜${q.question}`)].join(String.fromCharCode(10));
}

function copyFlaggedText() {
  const text = buildFlaggedLineText();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert('LINEに貼り付けやすい形式でコピーしました。');
    }).catch(() => {
      const box = document.getElementById('flaggedCopyBox');
      if (box) {
        box.focus();
        box.select();
      }
    });
  } else {
    const box = document.getElementById('flaggedCopyBox');
    if (box) {
      box.focus();
      box.select();
    }
  }
}

function renderFlaggedPage() {
  const flagged = QUESTION_BANK.filter(q => state.flaggedIds.includes(q.id));
  app.innerHTML = `
    <section class="result" style="text-align:left;">
      <div class="top-actions" style="justify-content:space-between; align-items:center; margin-bottom:12px;">
        <button class="secondary" onclick="backToQuiz()">戻る</button>
        <button class="secondary" onclick="clearAllFlags()" ${flagged.length ? '' : 'disabled'}>一括削除</button>
      </div>
      <span class="pill">違和感あり</span>
      <h2 style="margin-top:10px;">${flagged.length}件</h2>
      ${flagged.length ? `
        <textarea id="flaggedCopyBox" class="copy-box" readonly>${buildFlaggedLineText()}</textarea>
        <div class="top-actions" style="margin-top:10px; justify-content:flex-end;">
          <button class="secondary" onclick="copyFlaggedText()">コピー</button>
        </div>
        <div class="flag-list">
          ${flagged.map(q => `
            <div class="flag-item">
              <div class="flag-id">${q.id} / ${q.category}</div>
              <div class="flag-question">${q.question}</div>
            </div>
          `).join('')}
        </div>
      ` : '<p>登録はありません。</p>'}
    </section>
  `;
}

function openFlaggedPage() {
  state.view = 'flagged';
  renderFlaggedPage();
}

function backToQuiz() {
  state.view = 'quiz';
  render();
}

function clearAllFlags() {
  if (!state.flaggedIds || !state.flaggedIds.length) return;
  const ok = confirm('違和感ありをすべて削除しますか？');
  if (!ok) return;
  state.flaggedIds = [];
  saveState();
  updateStats();
  renderFlaggedPage();
}

function answer(choiceIndex) {
  if (state.locked) return;
  state.locked = true;
  const q = state.questions[state.index];
  const buttons = [...document.querySelectorAll('.choice')];
  const ok = choiceIndex === q.answer_index;
  state.answered += 1;
  if (!state.statsById[q.id]) state.statsById[q.id] = { seen: 0, wrong: 0, correct: 0, mastery: 0 };
  state.statsById[q.id].seen += 1;
  if (ok) {
    state.correct += 1;
    state.statsById[q.id].correct += 1;
    state.statsById[q.id].mastery = Math.min(3, (state.statsById[q.id].mastery || 0) + 1);
  } else {
    if (!state.wrongIds.includes(q.id)) state.wrongIds.push(q.id);
    state.statsById[q.id].wrong += 1;
    state.statsById[q.id].mastery = Math.max(0, (state.statsById[q.id].mastery || 0) - 2);
  }
  buttons.forEach((btn, i) => {
    if (i === q.answer_index) btn.classList.add('correct');
    if (i === choiceIndex && i !== q.answer_index) btn.classList.add('wrong');
    btn.disabled = true;
  });
  document.getElementById('explanation').style.display = 'block';
  updateStats();
  saveState();
  document.getElementById('nextBtn').disabled = false;
}

function next() {
  state.index += 1;
  state.locked = false;
  render();
}

function resetProgress() {
  state.correct = 0;
  state.answered = 0;
  state.index = 0;
  state.locked = false;
  state.view = 'quiz';
  prepareQuestions('all');
}

function renderResult() {
  const total = state.questions.length;
  const rate = total ? Math.round((state.correct / total) * 100) : 0;
  app.innerHTML = `
    <section class="result">
      <span class="pill">今回の結果</span>
      <h2>${total}問が終了しました</h2>
      <p>${total}問中 ${state.correct}問正解、正答率 ${rate}%</p>
      <p>次回は、間違えた問題や苦手傾向のある問題をやや多めに出題します。</p>
      <div class="footer" style="justify-content:center; margin-top:18px;">
        <button onclick="prepareQuestions('all')">次の10問へ</button>
        <button class="secondary" onclick="prepareQuestions('wrong')" ${state.wrongIds.length ? '' : 'disabled'}>間違えた問題から10問</button>
      </div>
    </section>
  `;
}

function render() {
  if (state.view === 'mastery') {
    const rows = categoryMasteryRows();
    app.innerHTML = `
      <section class="result" style="text-align:left;">
        <div class="top-actions" style="justify-content:space-between; align-items:center; margin-bottom:12px;">
          <button class="secondary" onclick="backToQuiz()">戻る</button>
        </div>
        <span class="pill">習熟度</span>
        <h2 style="margin-top:10px;">カテゴリ別の到達状況</h2>
        <div class="mastery-grid">
          ${rows.map(row => `
            <div class="mastery-card">
              <div class="mastery-head">
                <div class="mastery-title">${row.category}</div>
                <div class="mastery-percent">${row.avg}%</div>
              </div>
              <div class="bar"><div style="width:${row.avg}%"></div></div>
              <div class="mastery-meta">
                <span>完了 ${row.cleared}/${row.total}</span>
                <span>未着手 ${row.untouched}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
    return;
  }
  if (state.view === 'flagged') {
    renderFlaggedPage();
    return;
  }
  if (!state.questions.length) {
    app.innerHTML = `<section class="result"><h2>出題できる問題がありません</h2><p>カテゴリや条件を見直してください。</p></section>`;
    return;
  }
  if (state.index >= state.questions.length) {
    renderResult();
    return;
  }
  const q = state.questions[state.index];
  const progress = Math.round((state.index / state.questions.length) * 100);
  app.innerHTML = `
    <div class="meta">
      <span>${state.index + 1} / ${state.questions.length}</span>
      <span>${q.category}</span>
    </div>
    <div class="progress"><div style="width:${progress}%"></div></div>
    <h2 class="question">${q.question}</h2>
    <div class="choices">
      ${q.choices.map((c, i) => `<button class="choice" onclick="answer(${i})">${String.fromCharCode(65+i)}. ${c}</button>`).join('')}
    </div>
    <div class="explanation" id="explanation"><strong>解説:</strong> ${q.explanation}</div>
    <div class="issue-panel">
      <div class="issue-row">
        <div class="issue-actions">
          <button class="secondary ${state.bookmarkedIds.includes(q.id) ? 'active-flag' : ''}" onclick="toggleBookmarkCurrent()">ブックマーク</button>
          <button class="secondary ${state.flaggedIds.includes(q.id) ? 'active-flag' : ''}" onclick="toggleFlagCurrent()">違和感あり</button>
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="sub"></div>
    </div>
    <div class="sticky-next">
      <button id="nextBtn" onclick="next()" disabled>次へ</button>
    </div>
  `;
}

categorySelect.addEventListener('change', e => {
  state.currentCategory = e.target.value;
  state.view = 'quiz';
  prepareQuestions('all');
});

restartBtn.addEventListener('click', resetProgress);

retryWrongBtn.addEventListener('click', () => {
  state.view = 'quiz';
  prepareQuestions('wrong');
});

masteryPageBtn.addEventListener('click', openMasteryPage);

if (bookmarkPageBtn) {
  bookmarkPageBtn.addEventListener('click', renderBookmarks);
}

if (flaggedPageBtn) {
  flaggedPageBtn.addEventListener('click', openFlaggedPage);
}

if (savedToggleBtn && savedPanel) {
  savedToggleBtn.addEventListener('click', () => {
    const isOpen = savedPanel.classList.toggle('open');
    savedToggleBtn.textContent = isOpen ? '保存済みを閉じる' : '保存済み';
  });
}

window.answer = answer;
window.next = next;
window.prepareQuestions = prepareQuestions;
window.toggleFlagCurrent = toggleFlagCurrent;
window.toggleBookmarkCurrent = toggleBookmarkCurrent;
window.removeBookmark = removeBookmark;
window.renderBookmarks = renderBookmarks;
window.copyFlaggedText = copyFlaggedText;
window.openMasteryPage = openMasteryPage;
window.openFlaggedPage = openFlaggedPage;
window.backToQuiz = backToQuiz;
window.clearAllFlags = clearAllFlags;
window.resetProgress = resetProgress;

fetch('./questions.json')
  .then(res => res.json())
  .then(data => {
    QUESTION_BANK = data;
    buildCategories();
    prepareQuestions('all');
  })
  .catch(err => {
    console.error('Failed to load questions:', err);
    app.innerHTML = '<section class="result"><h2>問題データの読み込みに失敗しました</h2></section>';
  });
