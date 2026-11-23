/**
 * @module quiz-modal
 * Komponen quiz modal ringan, tanpa dependensi eksternal.
 * Render ke <div id="quiz"> yang sudah ada di hlwoa/index.html & hc-cso/index.html.
 *
 * Usage:
 *   import { initQuiz } from '../../web-components/quiz-modal.js';
 *   import { QUIZ_HLWOA } from './quiz-data.js';
 *   initQuiz(QUIZ_HLWOA, { accentColor: '#48cae4' });
 */

const CSS = /* css */`
.quiz-backdrop {
  display: none;
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(4px);
  align-items: center; justify-content: center;
}
.quiz-backdrop.open { display: flex; }
.quiz-box {
  background: var(--bg-panel, rgba(10,25,47,0.95));
  border: 1px solid var(--quiz-accent, #48cae4);
  border-radius: 1.1rem;
  padding: 2rem;
  max-width: 520px; width: 92vw;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  font-family: var(--font-body, 'Nunito', sans-serif);
  color: var(--text, #e6f1f8);
}
.quiz-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.2rem;
}
.quiz-header h3 {
  font-size: 1rem; font-weight: 800; letter-spacing: .5px;
  color: var(--quiz-accent, #48cae4);
}
.quiz-close {
  background: none; border: none; cursor: pointer;
  color: var(--text-muted, #8aaabe); font-size: 1.3rem; line-height: 1;
  padding: 2px 6px; border-radius: 4px;
}
.quiz-close:hover { color: var(--text, #e6f1f8); }
.quiz-progress {
  font-size: 0.75rem; color: var(--text-muted, #8aaabe);
  margin-bottom: 0.6rem;
}
.quiz-question {
  font-size: 0.97rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.4;
}
.quiz-options { display: flex; flex-direction: column; gap: 0.55rem; }
.quiz-opt {
  background: var(--bg-card, rgba(16,37,66,0.7));
  border: 1px solid var(--border, rgba(72,202,228,0.22));
  border-radius: 0.6rem; padding: 0.65rem 0.9rem;
  cursor: pointer; font-size: 0.88rem; text-align: left;
  color: var(--text, #e6f1f8); transition: border-color .15s, background .15s;
}
.quiz-opt:hover:not(:disabled) {
  border-color: var(--quiz-accent, #48cae4);
  background: rgba(72,202,228,0.08);
}
.quiz-opt.correct { border-color: #06d6a0; background: rgba(6,214,160,0.15); }
.quiz-opt.wrong   { border-color: #ef476f; background: rgba(239,71,111,0.12); }
.quiz-opt:disabled { cursor: default; }
.quiz-explanation {
  margin-top: 0.9rem; font-size: 0.82rem; line-height: 1.5;
  color: var(--text-muted, #8aaabe);
  border-left: 3px solid var(--quiz-accent, #48cae4);
  padding-left: 0.75rem;
}
.quiz-nav {
  margin-top: 1.1rem; display: flex; justify-content: flex-end; gap: 0.6rem;
}
.quiz-btn {
  padding: 0.5rem 1.3rem; border-radius: 2rem; border: none;
  cursor: pointer; font-weight: 800; font-size: 0.88rem;
  background: var(--quiz-accent, #48cae4); color: #050d1a;
  transition: opacity .15s;
}
.quiz-btn:hover { opacity: 0.85; }
.quiz-score {
  text-align: center; padding: 0.5rem 0 0.3rem;
}
.quiz-score .score-num {
  font-size: 2.4rem; font-weight: 800; color: var(--quiz-accent, #48cae4);
  display: block;
}
.quiz-score p { font-size: 0.88rem; color: var(--text-muted, #8aaabe); margin-top: 0.3rem; }
`;

function injectCSS() {
  if (document.getElementById('quiz-modal-css')) return;
  const s = document.createElement('style');
  s.id = 'quiz-modal-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function initQuiz(questions, { accentColor = '#48cae4', triggerSelector = '#btn-quiz' } = {}) {
  injectCSS();

  // Buat backdrop + box, mount ke #quiz
  const mount = document.getElementById('quiz');
  if (!mount) return;
  mount.removeAttribute('style');
  mount.removeAttribute('aria-hidden');

  mount.innerHTML = `
    <div class="quiz-backdrop" id="quiz-backdrop">
      <div class="quiz-box" role="dialog" aria-modal="true">
        <div class="quiz-header">
          <h3 id="quiz-title">❓ Kuis Singkat</h3>
          <button class="quiz-close" id="quiz-close" aria-label="Tutup">✕</button>
        </div>
        <div id="quiz-body"></div>
      </div>
    </div>`;

  // Set accent CSS var on box
  const box = mount.querySelector('.quiz-box');
  box.style.setProperty('--quiz-accent', accentColor);

  const backdrop = mount.querySelector('#quiz-backdrop');
  let current = 0, score = 0;

  function open() { backdrop.classList.add('open'); renderQuestion(); }
  function close() { backdrop.classList.remove('open'); }

  mount.querySelector('#quiz-close').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  // Tombol trigger di HUD (opsional)
  document.querySelector(triggerSelector)?.addEventListener('click', () => {
    current = 0; score = 0; open();
  });

  function renderQuestion() {
    const body = mount.querySelector('#quiz-body');
    if (current >= questions.length) { renderScore(body); return; }
    const q = questions[current];
    body.innerHTML = `
      <div class="quiz-progress">Soal ${current + 1} / ${questions.length}</div>
      <div class="quiz-question">${q.q}</div>
      <div class="quiz-options">
        ${q.options.map((opt, i) =>
          `<button class="quiz-opt" data-idx="${i}">${opt}</button>`
        ).join('')}
      </div>
      <div class="quiz-nav">
        <button class="quiz-btn" id="quiz-next" style="display:none">
          ${current + 1 < questions.length ? 'Lanjut →' : 'Lihat Skor'}
        </button>
      </div>`;

    body.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = parseInt(btn.dataset.idx);
        body.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = true; });
        if (chosen === q.answer) { btn.classList.add('correct'); score++; }
        else {
          btn.classList.add('wrong');
          body.querySelector(`[data-idx="${q.answer}"]`).classList.add('correct');
        }
        // Tampilkan penjelasan
        const nav = body.querySelector('.quiz-nav');
        nav.insertAdjacentHTML('beforebegin',
          `<div class="quiz-explanation">${q.explanation}</div>`);
        body.querySelector('#quiz-next').style.display = '';
      });
    });

    body.querySelector('#quiz-next')?.addEventListener('click', () => {
      current++; renderQuestion();
    });
  }

  function renderScore(body) {
    const pct = Math.round((score / questions.length) * 100);
    body.innerHTML = `
      <div class="quiz-score">
        <span class="score-num">${score} / ${questions.length}</span>
        <p>${pct === 100 ? '🎉 Sempurna!' : pct >= 67 ? '👍 Bagus!' : '📚 Coba lagi nanti.'}</p>
      </div>
      <div class="quiz-nav">
        <button class="quiz-btn" id="quiz-retry">Ulangi</button>
        <button class="quiz-btn" id="quiz-done" style="background:var(--bg-card,#102542);color:var(--text,#e6f1f8);border:1px solid var(--quiz-accent,#48cae4)">Tutup</button>
      </div>`;
    body.querySelector('#quiz-retry').addEventListener('click', () => { current = 0; score = 0; renderQuestion(); });
    body.querySelector('#quiz-done').addEventListener('click', close);
  }

  return { open, close };
}
