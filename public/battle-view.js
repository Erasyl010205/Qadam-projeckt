
import { createPythonQuiz } from './battle-quiz.js';
let quiz = null, previous = [];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function battleTest() {
 if (!quiz) return '<h2>Python тесті</h2><p>48 сұрақтың ішінен 20 сұрақ кездейсоқ таңдалады. Әр дұрыс жауап — 1 ұпай.</p><button class="btn btn-primary mt-3" data-battle="start">Тестті бастау · 20 сұрақ</button>';
 if (quiz.done) {
 const score = quiz.answers.filter((a,i)=>a===quiz.questions[i].answer).length;
 return '<h2>Тест аяқталды: '+score+' / 20</h2><p>'+score*5+'% дұрыс жауап</p><button class="btn btn-primary mt-3" data-battle="start">Жаңа 20 сұрақпен қайталау</button><h3 class="mt-4">Жауаптарды талдау</h3>'+quiz.questions.map((q,i)=>'<article class="battle-review"><h4>'+(i+1)+'. '+esc(q.prompt)+'</h4><p class="'+(quiz.answers[i]===q.answer?'battle-correct':'battle-wrong')+'">Сенің жауабың: '+esc(q.options[quiz.answers[i]])+' · '+(quiz.answers[i]===q.answer?'Дұрыс':'Қате')+'</p><p>Дұрыс жауап: <strong>'+esc(q.options[q.answer])+'</strong></p><p>'+esc(q.explanation)+'</p></article>').join('');
 }
 const q=quiz.questions[quiz.index];
 return '<h2 id="battle-question" tabindex="-1">Сұрақ '+(quiz.index+1)+' / 20</h2><div class="progress mb-4" role="progressbar" aria-label="Тест прогресі" aria-valuenow="'+quiz.index+'" aria-valuemin="0" aria-valuemax="20"><div class="progress-bar" style="width:'+quiz.index*5+'%"></div></div><form id="battle-test"><fieldset class="battle-fieldset"><legend>'+esc(q.prompt)+'</legend><div class="battle-options">'+q.options.map((o,i)=>'<label class="battle-option"><input type="radio" name="battle-answer" value="'+i+'" required '+(quiz.answers[quiz.index]===i?'checked':'')+'><span>'+esc(o)+'</span></label>').join('')+'</div></fieldset><div class="d-flex gap-3 mt-4"><button class="btn btn-outline" type="button" data-battle="back" '+(quiz.index===0?'disabled':'')+'>Артқа</button><button class="btn btn-primary" type="submit">'+(quiz.index===19?'Тестті аяқтау':'Келесі сұрақ')+'</button></div></form>';
}
function refresh(){const host=document.querySelector('#python-battle');if(host){host.innerHTML=battleTest();document.querySelector('#battle-question')?.focus();}}
document.addEventListener('click', e=>{
 const button=e.target.closest('[data-battle]');if(!button)return;
 if(button.dataset.battle==='start'){const questions=createPythonQuiz(previous);previous=questions.map(q=>q.id);quiz={questions,answers:[],index:0,done:false};}
 if(button.dataset.battle==='back' && quiz?.index>0)quiz.index--;
 refresh();
});
document.addEventListener('change',e=>{if(e.target.name==='battle-answer'&&quiz&&!quiz.done)quiz.answers[quiz.index]=Number(e.target.value);});
document.addEventListener('submit',e=>{
 if(e.target.id!=='battle-test')return;e.preventDefault();
 const answer=new FormData(e.target).get('battle-answer');if(answer===null||!quiz||quiz.done)return;
 quiz.answers[quiz.index]=Number(answer);
 if(quiz.index===19)quiz.done=true;else quiz.index++;
 refresh();
});
