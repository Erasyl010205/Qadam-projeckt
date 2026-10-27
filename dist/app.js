import { renderLesson } from './lesson-view.js';
import { gradeLesson, lessonChecks, workspaceTask } from './learning.js';
import { courses, demoLeaders } from './data.js';
import { loadState, saveState, completeLesson, resetState } from './state.js';

let state = loadState();
let courseFilter = 'all';
let searchTerm = '';
let battleMode = '1v1';
let activeEditorLesson = null;
let activeEditorStarter = '';
let toastTimer;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const titles = { dashboard: 'Оқу панелі', courses: 'Курстар', course: 'Курс мазмұны', lesson: 'Сабақ', workspace: 'Код алаңы', battles: 'Шайқастар', friends: 'Достар', leaderboard: 'Рейтинг', profile: 'Жеке профиль', settings: 'Баптаулар' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const brand = () => `<a class="brand" href="#home" aria-label="Qadam Code басты беті"><span class="brand-mark">${icon('code-2')}</span><span>qadam<em>code</em><span class="visually-hidden"> Qadam Code</span></span></a>`;
const initials = name => String(name).trim().slice(0, 2).toUpperCase();
const allLessons = courses.flatMap(c => c.lessons);
const findLesson = id => allLessons.find(l => l.id === id);
const findCourse = lessonId => courses.find(c => c.lessons.some(l => l.id === lessonId));
const dayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(date);
  const part = name => parts.find(p => p.type === name).value;
  return [part('year'),part('month'),part('day')].join('-');
};
const todayCount = () => state.activities.filter(a => a.date === dayKey()).length;
const level = () => Math.floor(state.xp / 250) + 1;
function streak() {
  const dates = new Set(state.activities.map(a => a.date));
  let n = 0;
  let date = new Date();
  if (!dates.has(dayKey(date))) date.setUTCDate(date.getUTCDate() - 1);
  while (dates.has(dayKey(date))) { n++; date.setUTCDate(date.getUTCDate() - 1); }
  return n;
}
function route() {
  return location.hash.slice(1).split('/').filter(Boolean);
}
function currentLesson() {
  return allLessons.find(l => !state.completed.includes(l.id)) || allLessons[0];
}
function progress(course) {
  const completed = course.lessons.filter(l => state.completed.includes(l.id)).length;
  return { completed, percent: Math.round(completed / course.lessons.length * 100) };
}
function updateIcons() {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 1.65 } });
}
function persist(next) {
  state = saveState(next);
}
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}
function openModal(title, content, iconName = 'sparkles') {
  modal.innerHTML = `<button class="modal-close" data-action="close-modal" aria-label="Терезені жабу">${icon('x')}</button><div class="modal-icon">${icon(iconName)}</div><h2 id="modal-title">${title}</h2>${content}`;
  modal.showModal();
  updateIcons();
}
function dateLabel() {
  const months = ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
  const [year,month,day] = dayKey().split('-').map(Number);
  return String(day) + ' ' + months[month-1] + ', ' + year;
}
function sidebar(page) {
  const nav = (id, label, glyph, badge = '') => `<a href="#${id}" class="${page === id || (id === 'courses' && ['course','lesson'].includes(page)) ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${badge}</a>`;
  return `<div class="mobile-overlay" data-action="close-menu"></div><aside class="sidebar" aria-label="Негізгі мәзір">${brand()}<div class="nav-label">БІЛІМГЕ БІР ҚАДАМ</div><nav class="side-nav">${nav('dashboard','Оқу панелі','layout-dashboard')}${nav('courses','Курстар','book-open')}${nav('workspace','Код алаңы','code-2')}</nav><div class="sidebar-sep"></div><div class="nav-label">БІРГЕ ДАМЫ</div><nav class="side-nav">${nav('battles','Шайқастар','swords','<span class="mini-badge">1v1 · 2v2</span>')}${nav('friends','Достар','users')}${nav('leaderboard','Рейтинг','trophy')}</nav><div class="sidebar-bottom"><div class="upgrade-box"><div class="small-star">${icon('sparkles')}</div><h4>Үлкен жол бір қадамнан.</h4><p>Күніне бір сабақ — жаңа дағдыға жақындай түс.</p><a href="#courses">Алғашқы қадамыңды жаса ${icon('arrow-up-right')}</a></div><nav class="side-nav">${nav('settings','Баптаулар','settings')}<a href="#help" data-action="help">${icon('circle-help')}<span>Көмек орталығы</span></a></nav><a href="#profile" class="profile-mini"><div class="avatar">${esc(initials(state.name))}</div><div><strong>${esc(state.name)}</strong><span>${level()}-деңгей · Демо профиль</span></div>${icon('chevrons-up-down')}</a></div></aside>`;
}
function shell(page, content) {
  return `${sidebar(page)}<div class="shell"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Мәзірді ашу" aria-expanded="false">${icon('menu')}</button><div class="breadcrumbs"><a href="#dashboard">Жеке кабинет</a>${icon('chevron-right')}<span>${titles[page] || 'Qadam Code'}</span></div><div class="top-actions"><span class="demo-chip" title="Деректер осы браузерде сақталады">Демо режим</span><span class="top-streak" title="Үздіксіз оқу күндері">${icon('flame')}${streak()}</span><button class="icon-btn" data-action="search" aria-label="Курсты іздеу">${icon('search')}</button><button class="icon-btn" data-action="notifications" aria-label="Хабарламалар">${icon('bell')}<span class="notification-dot"></span></button><a href="#profile" class="avatar" aria-label="Жеке профилің">${esc(initials(state.name))}</a></div></header><main id="main" class="page" tabindex="-1">${content}<footer class="footer"><span>© ${new Date().getFullYear()} Qadam Code. Күн сайын бір қадам алға.</span><div class="footer-links"><a href="#home">Жоба туралы</a><a href="#help" data-action="help">Көмек</a><span>Қазақша · KZ</span></div></footer></main></div>`;
}
function heading(title, subtitle = '', eyebrow = '') {
  return `<div class="page-heading"><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${title}</h1>${subtitle ? `<p class="subtext">${subtitle}</p>` : ''}</div><div class="date-pill">${icon('calendar-days')}${dateLabel()}</div></div>`;
}
function codeArt() {
  return `<div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="floating-bracket">{ }</div><div class="code-window"><div class="window-dots"><i></i><i></i><i></i><span>your_future.py</span></div><pre><span class="syntax-pink">def</span> <span class="syntax-blue">your_next_step</span>():\n    dream = <span class="syntax-green">"үлкен мүмкіндік"</span>\n    <span class="syntax-pink">return</span> practice + dream\n\n<span class="syntax-blue">print</span>(<span class="syntax-green">"Сәлем, болашақ!"</span>)</pre></div><div class="floating-code">${icon('check-check')}Бәрі алғашқы жолдан басталады</div></div>`;
}
function languageIcon(language) {
  return language === 'python' ? '<div class="language-icon python" aria-hidden="true"><span>p</span><span>y</span></div>' : `<div class="language-icon java" aria-hidden="true">${icon('coffee')}</div>`;
}
function courseCard(course) {
  const p = progress(course);
  return `<a href="#course/${course.id}" class="panel course-card ${course.id}" aria-label="${esc(course.title)} курсын ашу"><div class="course-visual ${course.id}">${languageIcon(course.id)}<span class="level-pill"><i></i><i></i><i></i>Бастапқы деңгей</span><div class="language-code" aria-hidden="true">${course.id === 'python' ? 'def learn():<br>&nbsp;&nbsp;return your_future<br><br>print("Hello, world!")' : 'public class Future {<br>&nbsp; void start() {<br>&nbsp;&nbsp; System.out.println("Qadam");<br>&nbsp; }<br>}'}</div></div><div class="course-body"><h3>${esc(course.title)}</h3><p>${esc(course.description)}</p><div class="course-meta"><span>${icon('layers')}${course.lessons.length} сабақ</span><span>${icon('clock-3')}${esc(course.duration)}</span><span>${icon('globe')}Қазақша</span></div><div class="progress-line"><span>Сенің прогресің</span><strong>${p.completed}/${course.lessons.length} сабақ</strong></div><div class="progress" role="progressbar" aria-label="Курс прогресі" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${p.percent}%"></div></div><div class="course-footer"><span>${p.completed ? 'Оқуды жалғастыру' : 'Үйренуді бастау'}</span>${icon('arrow-right')}</div></div></a>`;
}
function weekDays() {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US',{ timeZone:'Asia/Bishkek' }));
  const dow = (local.getDay() + 6) % 7;
  return ['Дс','Сс','Ср','Бс','Жм','Сб','Жс'].map((d, i) => {
    const date = new Date(now); date.setUTCDate(date.getUTCDate() + i - dow);
    const done = state.activities.some(a => a.date === dayKey(date));
    return `<span class="${i === dow ? 'today' : done ? 'done' : ''}" title="${esc(dayKey(date))}">${done ? '✓' : d}</span>`;
  }).join('');
}
function dashboard() {
  const lesson = currentLesson();
  const count = todayCount();
  return shell('dashboard', `${heading('Бүгін не үйренеміз?', '', `Сәлем, ${esc(state.name)}! Қайта оралғаныңа қуаныштымыз 👋`)}<div class="dashboard-top"><section class="hero-card"><div class="hero-kicker"><span></span>ӨЗ БОЛАШАҒЫҢДЫ КОДТА</div><h2>Кішкентай қадам.<br>Үлкен мүмкіндік.</h2><p>Python мен Java-ны қазақша үйрен.<br>Идеяңды кодқа, біліміңді дағдыға айналдыр.</p><a href="#lesson/${lesson.id}" class="btn btn-primary">${icon('play')}${state.completed.length ? 'Оқуды жалғастыру' : 'Алғашқы сабақты бастау'}${icon('arrow-right')}</a>${codeArt()}</section><section class="panel daily-card"><div class="card-label">${icon('target')}Күндік мақсатың</div><div class="goal-ring" style="--progress:${Math.min(100, count / state.goal * 100)}%"><div><strong>${count}</strong><span>/${state.goal}</span><small>сабақ аяқталды</small></div></div><p>${count >= state.goal ? 'Керемет! Бүгінгі мақсат орындалды.' : 'Әр сабақ сені алға жетелейді.'}</p><div class="week-days">${weekDays()}</div></section></div><div class="stat-grid"><div class="panel stat-card"><div class="stat-icon">${icon('book-open')}</div><div><div class="stat-number">${state.completed.length}<small> / ${allLessons.length}</small></div><p>Аяқталған сабақ</p></div>${icon('arrow-up-right','corner-icon')}</div><div class="panel stat-card"><div class="stat-icon gold">${icon('zap')}</div><div><div class="stat-number">${state.xp.toLocaleString()}<small> XP</small></div><p>Жиналған тәжірибе</p></div>${icon('arrow-up-right','corner-icon')}</div><div class="panel stat-card"><div class="stat-icon mint">${icon('sprout')}</div><div><div class="stat-number">${level()}<small> деңгей</small></div><p>Жаңа бастаушы</p></div>${icon('arrow-up-right','corner-icon')}</div></div><div class="dashboard-lower"><section><div class="section-heading"><h2>Сенің оқу жолың</h2><a href="#courses" class="text-link">Барлық курстар${icon('arrow-right')}</a></div><div class="course-grid">${courses.map(courseCard).join('')}</div><section class="battle-banner"><div class="battle-emblem">${icon('swords')}</div><div><span class="battle-tag"><i></i>БІРГЕ ҮЙРЕН. БІРГЕ ӨС.</span><h3>Кодыңды сынауға дайынсың ба?</h3><p>Досыңмен 1v1 немесе командамен 2v2. Біліміңді жаңа деңгейге көтер.</p></div><a href="#battles" class="btn">Шайқас алаңы${icon('arrow-up-right')}</a></section></section><aside class="panel leader-panel"><div class="section-heading"><h2>${icon('trophy','trophy-small')} Аптаның үздіктері</h2><a href="#leaderboard" aria-label="Толық рейтинг">${icon('arrow-up-right')}</a></div><p class="leader-caption"><span class="dot"></span>Рейтингтің демо көрінісі</p>${demoLeaders.slice(0,4).map((p,i) => `<div class="leader-row"><span class="leader-place ${i === 0 ? 'first' : ''}">${i + 1}</span><span class="avatar ${p.color}">${esc(initials(p.name))}</span><div><div class="leader-name">${esc(p.name)}</div><div class="leader-user">@${esc(p.username)}</div></div><span class="leader-xp">${p.xp.toLocaleString()}<small> XP</small></span></div>`).join('')}<div class="your-rank">${icon('zap')}<span>Сенің тәжірибең</span><strong>${state.xp} XP</strong></div><div style="margin-top:24px;padding-top:19px;border-top:1px solid #23304a"><div class="small-label" style="font-size:9px">БҮГІНГІ ОЙ</div><p style="font-size:11px;line-height:1.9;margin-top:10px;color:#a1b0c8">«Үлкен жетістік — күн сайын қайталанатын шағын әрекеттердің нәтижесі.»</p><span style="display:block;margin-top:12px;color:#617694;font-size:9px">Бүгінгі қадамыңды жаса →</span></div></aside></div>`);
}
function courseCatalog() {
  return shell('courses', `${heading('Біліміңе жаңа бағыт бер.','Өзіңе ұнайтын тілді таңда. Алғашқы жолыңды бүгін жаз.','КУРС КАТАЛОГЫ')}<div class="filter-bar"><button class="filter-btn ${courseFilter === 'all' ? 'active' : ''}" data-filter="all">Барлық курстар</button><button class="filter-btn ${courseFilter === 'python' ? 'active' : ''}" data-filter="python">Python</button><button class="filter-btn ${courseFilter === 'java' ? 'active' : ''}" data-filter="java">Java</button><div class="search-wrap">${icon('search')}<input id="course-search" class="form-control" placeholder="Курсты іздеу..." value="${esc(searchTerm)}" aria-label="Курсты іздеу"></div></div><div id="course-results" class="course-grid catalog-grid">${filteredCourses()}</div><div class="notice mt-4">${icon('sparkles')}<div><strong>Өз қарқыныңмен үйрен.</strong> Толық теория, қадамдап талданған мысалдар, жаттығулар және бірнеше тексеру сұрағы. Прогресің осы браузерде сақталады.</div></div>`);
}
function filteredCourses() {
  const matches = courses.filter(c => (courseFilter === 'all' || c.id === courseFilter) && (c.title + c.description + c.language).toLowerCase().includes(searchTerm.toLowerCase()));
  return matches.length ? matches.map(courseCard).join('') : `<div class="panel empty-state empty-search">${icon('search')}<h3>Курс табылмады</h3><p>Басқа сөз жазып көр немесе барлық курстарды таңда.</p><button class="btn btn-outline" data-action="clear-search">Іздеуді тазалау</button></div>`;
}
function courseDetail(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return notFound();
  const p = progress(course);
  const next = course.lessons.find(l => !state.completed.includes(l.id)) || course.lessons[0];
  return shell('course', `<a href="#courses" class="header-back">${icon('arrow-left')}Курс каталогына оралу</a><div class="course-detail"><div><div class="panel course-intro">${languageIcon(course.id)}<div class="small-label mb-2">ҚАЗАҚША · БАСТАПҚЫ ДЕҢГЕЙ</div><h2>${esc(course.title)}</h2><p>${esc(course.description)} Әр сабақта оқу мақсаттары, толық теория, екі талданған мысал, үш жаттығу және үш тексеру сұрағы бар.</p></div><div class="section-heading"><h2>Курс бағдарламасы</h2><span class="muted" style="font-size:10px">${course.lessons.length} сабақ</span></div><div class="panel lesson-list">${course.lessons.map((l,i) => `<a class="lesson-row" href="#lesson/${l.id}"><span class="lesson-number ${state.completed.includes(l.id) ? 'complete' : ''}">${state.completed.includes(l.id) ? icon('check') : String(i+1).padStart(2,'0')}</span><div><h3>${esc(l.title)}</h3><p>${l.minutes} минут · ${l.xp} XP · ${esc(l.module)}</p></div>${icon('chevron-right')}</a>`).join('')}</div></div><aside class="panel course-summary"><h3>Сенің оқу жолың</h3><p style="font-size:11px">${p.completed} сабақ аяқталды · ${p.percent}%</p><div class="progress mt-3 mb-3" role="progressbar" aria-label="Курс прогресі" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${p.percent}%"></div></div><div class="summary-item"><span>Деңгей</span><strong>Бастапқы</strong></div><div class="summary-item"><span>Тіл</span><strong>Қазақша</strong></div><div class="summary-item"><span>Көлемі</span><strong>${course.lessons.length} сабақ</strong></div><div class="summary-item"><span>Жалпы тәжірибе</span><strong>${course.lessons.reduce((n,l) => n+l.xp,0)} XP</strong></div><a class="btn btn-primary w-100 mt-4" href="#lesson/${next.id}">${icon('play')}${p.completed ? 'Жалғастыру' : 'Бастау'}</a><p class="mt-3" style="font-size:9px;text-align:center">Тегін демо курс · Өз қарқыныңмен үйрен</p></aside></div>`);
}
function lessonPage(id) {
  const lesson = findLesson(id), course = findCourse(id);
  if (!lesson || !course) return notFound();
  return shell('lesson',renderLesson(lesson,course,state.completed.includes(id)));
}
function workspacePage(id,exerciseIndex) {
  const lesson = findLesson(id) || currentLesson();
  const course = findCourse(lesson.id);
  const task = workspaceTask(lesson,course,exerciseIndex);
  activeEditorLesson = task.draftKey;
  activeEditorStarter = task.starter;
  const draft = state.drafts[task.draftKey] ?? task.starter;
  return shell('workspace', `${heading('Идеяңды кодқа айналдыр.','Жаттығуды оқы, шешім қадамдарын ойластыр және кодыңды жаз.','КОД АЛАҢЫ')}
    <div class="workspace">
      <aside class="panel task-panel">
        <span class="tag">${esc(course.language)} · ${task.index >= 0 ? 'Жаттығу '+(task.index+1) : 'Негізгі тапсырма'}</span>
        <h2>${esc(task.title)}</h2><p>${esc(task.description)}</p>
        ${task.input ? `<div class="task-output"><strong>Енгізілетін мәндер</strong><pre>${esc(task.input)}</pre></div>` : ''}
        ${task.output !== undefined ? `<div class="task-output"><strong>Күтілетін нәтиже</strong><pre>${esc(task.output)}</pre></div>` : ''}
        ${task.hint ? `<details class="lesson-disclosure mt-3"><summary>${icon('lightbulb')}Ишараны көру</summary><div class="disclosure-content"><p>${esc(task.hint)}</p></div></details>` : ''}
        <a href="#lesson/${lesson.id}" class="btn btn-outline mt-3 w-100">${icon('book-open')}Теория мен мысалдарға оралу</a>
        <div class="notice gold mt-4">${icon('info')}<div>Код нобайын сақтауға болады. Кодты орындау мен автоматты тесттер үшін оқшауланған сервер әлі қосылмаған.</div></div>
      </aside>
      <section class="panel editor-panel" aria-label="Код редакторы">
        <div class="editor-toolbar">
          <select class="form-select" id="editor-language" aria-label="Бағдарламалау тілі">${courses.map(c=>`<option value="${c.id}" ${c.id===course.id ? 'selected' : ''}>${esc(c.language)}</option>`).join('')}</select>
          <span>${course.id==='python' ? 'main.py' : 'Main.java'}</span>
          <button class="icon-btn" data-action="reset-code" aria-label="Бастапқы кодқа қайтару" title="Бастапқы код">${icon('rotate-ccw')}</button>
        </div>
        <div class="exercise-picker"><label for="editor-exercise">Осы тақырыптың жаттығулары</label><select class="form-select" id="editor-exercise"><option value="${lesson.id}" ${task.index===-1 ? 'selected' : ''}>Негізгі тапсырма</option>${(lesson.practice || []).map((p,i)=>`<option value="${lesson.id}/${i}" ${task.index===i ? 'selected' : ''}>${i+1}. ${esc(p.title)}</option>`).join('')}</select></div>
        <div class="editor-wrap"><div class="line-numbers" aria-hidden="true">${Array.from({length:Math.max(15,draft.split('\n').length)},(_,i)=>i+1).join('\n')}</div><textarea id="code-editor" class="code-editor" spellcheck="false" autocapitalize="off" aria-label="${esc(course.language)} кодын жазу">${esc(draft)}</textarea></div>
        <div class="editor-actions"><button class="btn btn-outline" data-action="save-code">${icon('save')}Нобайды сақтау</button><button class="btn btn-quiet" data-action="run-code">${icon('play')}Іске қосу</button><button class="btn btn-primary" data-action="submit-code">${icon('send')}Шешімді жіберу</button></div>
        <div class="console-header">${icon('terminal')}Нәтиже<div class="code-status ms-auto"><i></i>Орындау сервисі қосылмаған</div></div><div id="console-output" class="console-body" role="status" aria-live="polite">Кодыңды жазып, өзің болжаған нәтижемен салыстыр.\nӘр жаттығудың нобайы осы браузерде бөлек сақталады.</div>
      </section>
    </div>`);
}
function battlesPage() {
  return shell('battles', `${heading('Бірге кодта. Бірге шыңдал.','Достық бәсеке арқылы үйренудің жаңа форматы.','ШАЙҚАС АЛАҢЫ')}<div class="notice mb-4">${icon('info')}Бұл — шайқас режимдерінің таныстырылымы. Нақты қарсылас, бөлме және онлайн матч сервер қосылғанда қолжетімді болады.</div><div class="mode-grid"><button class="panel mode-card ${battleMode === '1v1' ? 'selected' : ''}" data-mode="1v1" aria-pressed="${battleMode === '1v1'}"><div class="mode-icon">${icon('swords')}</div><h3>1 vs 1</h3><p>Бір тапсырма. Екі бағдарламашы.<br>Дұрыс шешімге бірінші жеткен ойыншы жеңеді.</p><span class="mode-label">ЖЕКЕ ДУЭЛЬ · 2 ОЙЫНШЫ</span></button><button class="panel mode-card ${battleMode === '2v2' ? 'selected' : ''}" data-mode="2v2" aria-pressed="${battleMode === '2v2'}"><div class="mode-icon">${icon('users')}</div><h3>2 vs 2</h3><p>Досыңмен команда құрып, қарсыласқа жолық.<br>Командадағы алғашқы дұрыс шешім жеңіс әкеледі.</p><span class="mode-label">КОМАНДАЛЫҚ ОЙЫН · 4 ОЙЫНШЫ</span></button></div><section class="panel battle-config"><h3>Өз форматыңды таңда</h3><div class="row g-3 align-items-end"><div class="col-md-4"><label class="form-label" for="battle-language">Бағдарламалау тілі</label><select id="battle-language" class="form-select"><option value="python">Python</option><option value="java">Java</option></select></div><div class="col-md-4"><label class="form-label" for="battle-level">Қиындық деңгейі</label><select id="battle-level" class="form-select"><option>Бастапқы деңгей</option><option disabled>Орта деңгей — жақында</option></select></div><div class="col-md-4"><button class="btn btn-primary w-100" data-action="battle-preview">${icon('swords')}${battleMode} форматын көру</button></div></div></section><section class="panel battle-rules"><h3>Шайқас қалай өтеді?</h3><ol class="mb-0 ps-3"><li>Жеке бөлмеге досыңды шақырасың.</li><li>Барлық ойыншы бірдей тапсырманы бір уақытта алады.</li><li>Шешімдер сервердегі жасырын тесттермен тексеріледі.</li><li>2v2 режимінде әркім өз кодын жазады. Командадағы бір ойыншының дұрыс шешімі жеткілікті.</li></ol></section>`);
}
function friendsPage() {
  return shell('friends', `${heading('Жақсы код — жақсы ортамен.','Бірге үйренетін серігіңді тап.','ДОСТАР')}<div class="filter-bar"><button class="filter-btn active">Достарым · 0</button><span class="demo-chip">Өтініштер · 0</span><div class="search-wrap">${icon('search')}<input id="friend-search" class="form-control" placeholder="Демо профильді іздеу..." aria-label="Демо профильді іздеу"></div></div><div class="notice mb-4">${icon('info')}Қазір төменде үлгі профильдер көрсетілген. Нақты іздеу, достық сұраулар мен онлайн статустар сервер қосылғанда іске қосылады.</div><div id="friend-results" class="friend-grid">${friendCards(demoLeaders)}</div>`);
}
function friendCards(players) {
  return players.length ? players.map(p => `<article class="panel friend-card"><div class="avatar ${p.color}">${esc(initials(p.name))}</div><h3>${esc(p.name)}</h3><p>@${esc(p.username)} · Демо профиль</p><button class="btn btn-outline w-100" data-action="friend-request">${icon('user-plus')}Досқа қосу</button></article>`).join('') : `<div class="panel empty-state empty-search">${icon('search')}<h3>Профиль табылмады</h3><p>Үлгі тізіміндегі басқа атты іздеп көр.</p></div>`;
}
function leaderboardPage() {
  return shell('leaderboard', `${heading('Келесі белеске бірге.','Күнделікті еңбектің нәтижесін көр. Өз рекордыңды жаңарт.','РЕЙТИНГ')}<div class="notice mb-4">${icon('info')}Рейтингтегі ойыншылар мен ұпайлар — үлгі деректер. Сенің жергілікті оқу тәжірибең: ${state.xp} XP.</div><div class="panel table-panel"><table class="ranking-table"><thead><tr><th>ОРЫН</th><th>ОҚУШЫ</th><th>ТӘЖІРИБЕ</th><th>ОҚУ КҮНДЕРІ</th><th>МӘРТЕБЕ</th></tr></thead><tbody>${demoLeaders.map((p,i) => `<tr><td class="${i < 3 ? 'rank-icon' : ''}">${String(i+1).padStart(2,'0')} ${i === 0 ? '♛' : ''}</td><td><div class="player"><div class="avatar ${p.color}">${esc(initials(p.name))}</div><div><strong>${esc(p.name)}</strong><p>@${esc(p.username)}</p></div></div></td><td><strong>${p.xp.toLocaleString()}</strong> XP</td><td>${p.streak} күн</td><td><span class="demo-chip">Демо</span></td></tr>`).join('')}<tr style="background:#142440"><td>—</td><td><div class="player"><div class="avatar">${esc(initials(state.name))}</div><div><strong>${esc(state.name)} <span class="blue-text">(сен)</span></strong><p>@${esc(state.username)}</p></div></div></td><td><strong>${state.xp}</strong> XP</td><td>${streak()} күн</td><td><span class="demo-chip">Осы браузер</span></td></tr></tbody></table></div>`);
}
function profilePage() {
  const achievements = [
    ['footprints','Алғашқы қадам','Бір сабақты аяқта.',state.completed.length >= 1],
    ['zap','Қарқын алдың','250 XP жина.',state.xp >= 250],
    ['flame','Тұрақтылық','3 күн қатарынан үйрен.',streak() >= 3],
    ['book-check','Тілге алғашқы жол','Бір курсты аяқта.',courses.some(c => progress(c).percent === 100)],
    ['trophy','Білім шыңы','Барлық сабақты аяқта.',state.completed.length === allLessons.length],
    ['gem','Тәжірибе жинаушы','1000 XP жина.',state.xp >= 1000]
  ];
  const dots = Array.from({length:56},(_,i) => { const date = new Date(); date.setUTCDate(date.getUTCDate()-55+i); return `<span class="${state.activities.some(a => a.date === dayKey(date)) ? 'active' : ''}" title="${dayKey(date)}"></span>`; }).join('');
  return shell('profile', `${heading('Сенің әр қадамың маңызды.','','ЖЕКЕ ПРОФИЛЬ')}<div class="profile-grid"><aside class="panel profile-card"><div class="avatar">${esc(initials(state.name))}</div><h2>${esc(state.name)}</h2><p>@${esc(state.username)}</p><span class="profile-level">${level()}-деңгей · Жаңа бастаушы</span><div class="row g-0 my-3"><div class="col-6" style="border-right:1px solid #2b3b56"><strong style="font-size:22px">${state.xp}</strong><p>тәжірибе XP</p></div><div class="col-6"><strong style="font-size:22px">${state.completed.length}</strong><p>сабақ</p></div></div><a href="#settings" class="btn btn-outline w-100 mt-3">${icon('settings')}Профильді өзгерту</a><p style="font-size:9px;margin-top:20px">Демо профиль · Осы браузерде сақталады</p></aside><div><div class="section-heading"><h2>Жетістіктерің</h2><span class="muted" style="font-size:10px">${achievements.filter(a => a[3]).length} / 6</span></div><div class="achievement-grid">${achievements.map(a => `<div class="panel achievement ${a[3] ? 'earned' : ''}" title="${a[3] ? 'Ашылды' : 'Әлі ашылмаған'}">${icon(a[0])}<h3>${a[1]}</h3><p>${a[2]}</p></div>`).join('')}</div><div class="panel p-4 mt-4"><div class="section-heading"><h2 style="font-size:15px">Оқу белсенділігі</h2><span class="muted" style="font-size:9px">Соңғы 8 апта</span></div><div class="activity-dots">${dots}</div><div class="activity-caption"><span>8 апта бұрын</span><span>Бүгін</span></div></div></div></div>`);
}
function settingsPage() {
  return shell('settings', `${heading('Өзіңе ыңғайлы болсын.','Жергілікті профилің мен оқу мақсатыңды бапта.','БАПТАУЛАР')}<form class="panel settings-card" id="settings-form"><h2>Жеке деректер</h2><label for="profile-name" class="form-label">Атың</label><input class="form-control" id="profile-name" name="name" value="${esc(state.name)}" maxlength="40" minlength="2" required><label for="profile-username" class="form-label">Пайдаланушы аты</label><input class="form-control" id="profile-username" name="username" value="${esc(state.username)}" maxlength="24" minlength="3" pattern="[a-zA-Z0-9_]+" required aria-describedby="username-hint"><p id="username-hint" style="font-size:10px;margin-top:6px">Латын әріптері, сандар және төменгі сызық.</p><label class="form-label" for="daily-goal">Күндік мақсат</label><select class="form-select" id="daily-goal" name="goal">${[1,2,3,5].map(n => `<option value="${n}" ${state.goal === n ? 'selected' : ''}>Күніне ${n} сабақ</option>`).join('')}</select><button class="btn btn-primary" type="submit">${icon('check')}Өзгерістерді сақтау</button><div class="notice mt-4">${icon('shield-check')}Деректер осы браузерде сақталады. Бұл форма нақты аккаунт құрмайды.</div></form><div class="panel settings-card mt-4"><h2>Жергілікті прогресс</h2><p style="font-size:11px">Оқу жолын қайта бастау үшін осы браузердегі барлық нобай мен прогресті тазалауға болады.</p><button class="btn btn-outline" data-action="reset-progress">${icon('rotate-ccw')}Прогресті тазалау</button></div>`);
}
function landingPage() {
  return `<div class="landing"><header class="landing-nav">${brand()}<nav class="landing-links"><a href="#courses">Курстар</a><a href="#battles">Шайқастар</a><a href="#login">Кіру</a><a href="#dashboard" class="btn btn-primary">Үйренуді бастау${icon('arrow-right')}</a></nav></header><main id="main"><section class="landing-hero"><div><span class="landing-pill">${icon('sparkles')}Қазақша үйрен. Болашағыңды кодта.</span><h1>Үлкен мүмкіндікке<br><span>алғашқы қадамың.</span></h1><p>Python мен Java-ны түсінікті сабақтар арқылы үйрен. Код жаз, тәжірибе жина және достарыңмен бірге дамы.</p><div class="d-flex gap-3 flex-wrap"><a href="#dashboard" class="btn btn-primary">Тегін үйренуді бастау${icon('arrow-right')}</a><a href="#courses" class="btn btn-outline">Курстарды көру</a></div><div class="landing-notes"><span>${icon('check')}Қазақ тілінде</span><span>${icon('check')}Өз қарқыныңмен</span><span>${icon('check')}Бастауға оңай</span></div></div>${codeArt()}</section><div class="landing-features"><article class="panel feature-card">${icon('book-open')}<h3>Түсін. Жаз. Бекіт.</h3><p>Қысқа сабақтар мен нақты код мысалдары. Әр тақырыптан кейін біліміңді сұрақпен бекіт.</p></article><article class="panel feature-card">${icon('code-2')}<h3>Алғашқы жолыңды жаз.</h3><p>Java мен Python тапсырмаларына өз шешіміңді дайында. Нобайыңды браузерде сақта.</p></article><article class="panel feature-card">${icon('swords')}<h3>Бірге өсу қызығырақ.</h3><p>Болашақ 1v1 және 2v2 шайқастарына дайындал. Қазір оқу жолыңның алғашқы қадамын жаса.</p></article></div><section class="panel p-4 p-md-5 mb-5 text-center"><div class="small-label mb-3">ЖАҢА ДАҒДЫ. ЖАҢА МҮМКІНДІК.</div><h2 style="font-size:28px">Бастау үшін мінсіз сәт — бүгін.</h2><p class="my-3" style="font-size:12px">16 қазақша сабақ сені күтіп тұр.</p><a href="#courses" class="btn btn-primary">Курс таңдау${icon('arrow-right')}</a></section></main><footer class="footer"><span>© ${new Date().getFullYear()} Qadam Code</span><div class="footer-links"><a href="#help" data-action="help">Көмек орталығы</a><span>Күн сайын бір қадам алға.</span></div></footer></div>`;
}
function authPage(register) {
  return `<div class="auth-shell"><aside class="auth-story">${brand()}<h1>Күн сайын<br>бір қадам.<br><span>Мүмкіндігің шексіз.</span></h1><p>Өзің сенетін болашақты бүгіннен құрастыр. Қазақша сабақтар, жаңа дағдылар және ортақ мақсат.</p><small>© ${new Date().getFullYear()} Qadam Code · Бірге үйрен. Бірге өс.</small></aside><main id="main" class="auth-form-area"><div class="auth-form"><a href="#home" class="auth-back">${icon('arrow-left')}Басты бетке</a><h2>${register ? 'Алғашқы қадамыңды жаса.' : 'Қайта оралғаныңа қуаныштымыз.'}</h2><p>${register ? 'Жаңа білімге жол аш.' : 'Оқу жолыңды жалғастыр.'}</p><div class="notice">${icon('info')}Аккаунт сервисі әзірге қосылмаған. Демо профильмен оқуды бірден бастауға болады.</div><form id="auth-form">${register ? '<label for="auth-name" class="form-label">Атың</label><input id="auth-name" class="form-control" autocomplete="name" maxlength="40" placeholder="Сені қалай атаймыз?">' : ''}<label class="form-label" for="auth-email">Электрондық пошта</label><input id="auth-email" class="form-control" type="email" autocomplete="email" placeholder="sen@example.com" disabled><label class="form-label" for="auth-password">Құпиясөз</label><input id="auth-password" class="form-control" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="••••••••" disabled><button class="btn btn-primary" type="button" disabled>${register ? 'Аккаунт ашу — жақында' : 'Аккаунтқа кіру — жақында'}</button></form><p class="auth-switch">${register ? 'Аккаунтың бар ма? <a href="#login">Кіру</a>' : 'Әлі тіркелмедің бе? <a href="#register">Тіркелу</a>'}</p><div class="auth-demo"><p>Тіркелусіз танысу · прогресс осы браузерде сақталады</p><button class="btn btn-outline" data-action="demo-login">${icon('play')}Демо режимде жалғастыру</button></div></div></main></div>`;
}
function notFound() {
  return shell('courses', `<div class="panel empty-state">${icon('compass')}<h3>Бұл жол әлі ашылмаған</h3><p>Қажетті бет табылмады. Оқу панеліне оралып, бағытыңды таңда.</p><a class="btn btn-primary" href="#dashboard">Оқу панеліне оралу</a></div>`);
}
function render({ saveEditor = true } = {}) {
  if (saveEditor && document.querySelector('#code-editor') && activeEditorLesson) saveDraft(false);
  activeEditorLesson = null;
  const [page = 'dashboard', id, exerciseIndex] = route();
  const views = { dashboard, home:landingPage, courses:courseCatalog, course:() => courseDetail(id), lesson:() => lessonPage(id), workspace:() => workspacePage(id,exerciseIndex), battles:battlesPage, friends:friendsPage, leaderboard:leaderboardPage, profile:profilePage, settings:settingsPage, login:() => authPage(false), register:() => authPage(true) };
  app.innerHTML = (views[page] || notFound)();
  app.querySelector('.mobile-menu')?.insertAdjacentHTML('afterend',brand());
  app.querySelector('#main')?.setAttribute('tabindex','-1');
  document.title = `${titles[page] || (page === 'home' ? 'Күн сайын бір қадам алға' : 'Қош келдің')} — Qadam Code`;
  updateIcons();
  window.scrollTo({ top:0, behavior:'instant' });
}
function saveDraft(feedback = true) {
  const editor = document.querySelector('#code-editor');
  if (!editor || !activeEditorLesson) return;
  persist({ ...state, drafts:{ ...state.drafts, [activeEditorLesson]:editor.value.slice(0,20000) } });
  if (feedback) toast('Код нобайы осы браузерде сақталды.');
}
document.addEventListener('click', event => {
  const sectionLink = event.target.closest('[data-section]');
  if (sectionLink) {
    event.preventDefault();
    const section = document.getElementById(sectionLink.dataset.section);
    if (section) { section.setAttribute('tabindex','-1'); section.focus({preventScroll:true}); section.scrollIntoView({behavior:'instant',block:'start'}); }
    return;
  }
  const copyButton = event.target.closest('[data-copy-code]');
  if (copyButton) {
    event.preventDefault();
    const code = document.getElementById(copyButton.dataset.copyCode)?.textContent;
    if (code !== undefined) {
      if (!navigator.clipboard?.writeText) { toast('Кодты белгілеп, Ctrl+C арқылы көшір.'); return; }
      navigator.clipboard.writeText(code).then(()=>toast('Код көшірілді.')).catch(()=>toast('Кодты белгілеп, Ctrl+C арқылы көшір.'));
    }
    return;
  }
  if (event.target.closest('.skip-link')) { event.preventDefault(); document.querySelector('#main')?.focus(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { courseFilter = filter.dataset.filter; render(); return; }
  const mode = event.target.closest('[data-mode]');
  if (mode) { battleMode = mode.dataset.mode; render(); return; }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  event.preventDefault();
  if (action === 'close-modal') { modal.close(); return; }
  if (action === 'menu' || action === 'close-menu') {
    const open = action === 'menu' && !document.querySelector('.sidebar').classList.contains('open');
    document.querySelector('.sidebar')?.classList.toggle('open', open);
    document.querySelector('.mobile-overlay')?.classList.toggle('show', open);
    document.querySelector('.mobile-menu')?.setAttribute('aria-expanded', String(open));
  }
  if (action === 'help') openModal('Көмек орталығы', '<p>Курсты таңда, сабақты оқы және соңындағы барлық сұраққа жауап бер. Дұрыс жауаптан кейін тәжірибе ұпайы бір рет беріледі.</p><p class="mt-3">Код алаңындағы нобайыңды сақтауға болады. Аккаунттар, код орындау және онлайн шайқастар келесі кезеңде қосылады.</p><a class="btn btn-primary" href="#courses" data-action="modal-courses">Курстарды ашу</a>', 'circle-help');
  if (action === 'modal-courses') { modal.close(); location.hash = 'courses'; }
  if (action === 'notifications') openModal('Жаңа жолға қош келдің!', '<p>Сенің алғашқы сабағың дайын. Өзіңе ыңғайлы тілді таңдап, бүгін бір қадам жаса.</p><p class="mt-3">Бұл — құрылғыда сақталатын демо нұсқа. Жеке хабарламалар сервисі әзірге қосылмаған.</p><a class="btn btn-primary" href="#courses" data-action="modal-courses">Курс таңдау</a>', 'bell');
  if (action === 'search') {
    openModal('Не үйренгің келеді?', '<label for="global-search" class="form-label">Курсты іздеу</label><input id="global-search" class="form-control" placeholder="Python немесе Java"><div class="d-flex gap-2 mt-3"><a class="btn btn-outline" href="#course/python" data-action="modal-python">Python</a><a class="btn btn-outline" href="#course/java" data-action="modal-java">Java</a></div>', 'search');
    document.querySelector('#global-search')?.focus();
  }
  if (action === 'modal-python' || action === 'modal-java') { modal.close(); location.hash = `course/${action === 'modal-python' ? 'python' : 'java'}`; }
  if (action === 'clear-search') { searchTerm = ''; courseFilter = 'all'; render(); }
  if (action === 'save-code') saveDraft();
  if (action === 'reset-code') {
    openModal('Кодты бастапқы түріне қайтару', '<p>Осы жаттығуда жазған нобайың бастапқы үлгімен ауыстырылады.</p><button class="btn btn-primary" data-action="confirm-reset-code">Бастапқы үлгіге қайтару</button>', 'rotate-ccw');
  }
  if (action === 'confirm-reset-code') {
    const editor = document.querySelector('#code-editor');
    if (editor && activeEditorLesson) { editor.value = activeEditorStarter; saveDraft(false); toast('Бастапқы код қайтарылды.'); }
    modal.close();
  }
  if (action === 'run-code' || action === 'submit-code') {
    saveDraft(false);
    document.querySelector('#console-output').textContent = action === 'run-code' ? 'Орындау сервисі қосылмаған.\nКод орындалған жоқ. Нобайың сақталды.\nОқшауланған Java/Python сервисі келесі кезеңде қосылады.' : 'Шешімді бағалау сервисі қосылмаған.\nАвтоматты тест орындалған жоқ. XP берілген жоқ.\nСабақтағы білімді бекіту сұрағын орындауға болады.';
    toast('Сервис әзірге қосылмаған. Код нобайы сақталды.');
  }
  if (action === 'battle-preview') {
    const language = document.querySelector('#battle-language').value;
    openModal(`${battleMode} · Шайқасқа дайындал`, `<p>${battleMode === '2v2' ? 'Екі командада екі ойыншыдан болады. Әр ойыншы өз шешімін жазады. Командадағы алғашқы толық дұрыс шешім жеңіс әкеледі.' : 'Екі ойыншы бір тапсырманы шешеді. Барлық тесттен бірінші өткен шешім жеңеді.'}</p><p class="mt-3">Нақты бөлме сервер қосылғанда ашылады. Әзірге осы тілде жеке жаттығуға болады.</p><button class="btn btn-primary" data-action="battle-practice" data-language="${language}">${icon('code-2')}Жаттығуды ашу</button>`, 'swords');
  }
  if (action === 'battle-practice') { modal.close(); location.hash = `workspace/${courses.find(c => c.id === target.dataset.language).lessons[0].id}`; }
  if (action === 'friend-request') openModal('Бірге үйрену жақында қосылады', '<p>Бұл — үлгі профиль. Нақты достық сұраулар аккаунт сервисі қосылғанда жіберіледі.</p><p class="mt-3">Қазір курстағы біліміңді шыңдап, алғашқы жетістігіңді аша аласың.</p><a class="btn btn-primary" href="#courses" data-action="modal-courses">Курс таңдау</a>', 'user-plus');
  if (action === 'demo-login') {
    const name = document.querySelector('#auth-name')?.value.trim();
    if (name && name.length >= 2) persist({ ...state, name:name.slice(0,40) });
    location.hash = 'dashboard'; toast('Демо профильге қош келдің!');
  }
  if (action === 'reset-progress') openModal('Оқу жолын қайта бастау', '<p>Осы браузердегі сабақ прогресі, XP, код нобайлары және профиль баптаулары тазаланады. Бұл әрекетті кері қайтару мүмкін емес.</p><button class="btn btn-primary" data-action="confirm-reset">Прогресті толық тазалау</button><button class="btn btn-outline ms-2" data-action="close-modal">Бас тарту</button>', 'rotate-ccw');
  if (action === 'confirm-reset') { state = resetState(); modal.close(); render({ saveEditor:false }); toast('Прогресс тазаланды. Жаңа қадамға дайынсың!'); }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'quiz-form') {
    event.preventDefault();
    const lesson = findLesson(event.target.dataset.lesson);
    const form = new FormData(event.target);
    const answers = lessonChecks(lesson).map((_,i)=>form.get('answer-'+i));
    const grade = gradeLesson(lesson,answers);
    const already = state.completed.includes(lesson.id);
    if (grade.allCorrect) {
      persist(completeLesson(state,lesson.id,lesson.xp));
      const position = window.scrollY;
      render();
      window.scrollTo(0,position);
    }
    grade.results.forEach((result,i)=>{
      const question=document.querySelector('#question-'+i), feedback=document.querySelector('#question-feedback-'+i);
      question.classList.toggle('answer-correct',result.correct);
      question.classList.toggle('answer-incorrect',!result.correct);
      if (result.selected !== null) {
        const radio=question.querySelector('input[value="'+result.selected+'"]');
        if (radio) radio.checked=true;
      }
      feedback.textContent = result.selected === null ? 'Жауапты таңда.' : (result.correct ? 'Дұрыс! ' : 'Қайта ойланып көр. ')+result.explanation;
    });
    const feedback = document.querySelector('#quiz-feedback');
    feedback.innerHTML = grade.allCorrect
      ? `<div class="notice success">${icon('check-circle')}<div><strong>${grade.correct}/${grade.total} — барлығы дұрыс!</strong><br>${already ? 'Бұл сабақтың XP ұпайы бұрын берілген. Қайталау біліміңді бекітеді.' : 'Сабақ аяқталды. +'+lesson.xp+' XP'}</div></div>`
      : `<div class="notice gold">${icon('info')}<div><strong>${grade.correct}/${grade.total} дұрыс жауап.</strong><br>Түсіндірмелерді оқып, қате жауаптарды түзет. Сабақты аяқтау үшін барлық сұраққа дұрыс жауап беру керек.</div></div>`;
    updateIcons();
    if (grade.allCorrect) toast(already ? 'Тақырыпты сәтті қайталадың. Қосымша XP берілмейді.' : 'Сабақ толық аяқталды. +'+lesson.xp+' XP');
  }
  if (event.target.id === 'settings-form') {
    event.preventDefault();
    const form = new FormData(event.target);
    persist({ ...state, name:String(form.get('name')).trim(), username:String(form.get('username')).trim(), goal:Number(form.get('goal')) });
    render(); toast('Профиль мен оқу мақсаты сақталды.');
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'course-search') {
    searchTerm = event.target.value;
    document.querySelector('#course-results').innerHTML = filteredCourses(); updateIcons();
  }
  if (event.target.id === 'friend-search') {
    const q = event.target.value.toLowerCase();
    document.querySelector('#friend-results').innerHTML = friendCards(demoLeaders.filter(p => (p.name + p.username).toLowerCase().includes(q))); updateIcons();
  }
  if (event.target.id === 'code-editor') {
    const lines = Math.max(15, event.target.value.split('\n').length);
    document.querySelector('.line-numbers').textContent = Array.from({length:Math.min(500,lines)},(_,i) => i+1).join('\n');
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'editor-exercise') { saveDraft(false); location.hash='workspace/'+event.target.value; }
  if (event.target.id === 'editor-language') {
    saveDraft(false);
    location.hash = `workspace/${courses.find(c => c.id === event.target.value).lessons[0].id}`;
  }
});
document.addEventListener('keydown', event => {
  if (event.target.id === 'global-search' && event.key === 'Enter') { searchTerm = event.target.value; courseFilter = 'all'; modal.close(); location.hash = 'courses'; if (route()[0] === 'courses') render(); }
  if (event.target.id === 'code-editor' && event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault();
    const editor = event.target, start = editor.selectionStart, end = editor.selectionEnd;
    editor.setRangeText('    ',start,end,'end');
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 's' && document.querySelector('#code-editor')) { event.preventDefault(); saveDraft(); }
  if (event.key === 'Escape') {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.mobile-overlay')?.classList.remove('show');
    document.querySelector('.mobile-menu')?.setAttribute('aria-expanded','false');
  }
});
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', () => saveDraft(false));
window.addEventListener('storage', event => { if (event.key === 'qadam-code:v1') { state = loadState(); render({ saveEditor:false }); } });
if (!location.hash) history.replaceState(null,'','#dashboard');
render();
