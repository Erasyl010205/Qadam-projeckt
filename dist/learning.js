// Knowledge checks are public learning material, not hidden code execution tests.
export function lessonChecks(lesson) {
  return lesson.checks?.length ? lesson.checks : [{
    question:lesson.question, options:lesson.options, answer:lesson.answer, explanation:lesson.explanation
  }];
}

export function gradeLesson(lesson, answers) {
  const checks = lessonChecks(lesson);
  const results = checks.map((check,index) => {
    const raw = answers[index];
    const selected = raw !== null && raw !== undefined && raw !== '' && /^[0-9]+$/.test(String(raw)) ? Number(raw) : null;
    const valid = Number.isInteger(selected) && selected >= 0 && selected < check.options.length;
    return { correct:valid && selected === check.answer, selected:valid ? selected : null, explanation:check.explanation };
  });
  const correct = results.filter(r => r.correct).length;
  return { total:checks.length,correct,allCorrect:correct === checks.length,unanswered:results.filter(r => r.selected === null).length,results };
}

export function workspaceTask(lesson, course, exerciseIndex) {
  const index = typeof exerciseIndex === 'string' && /^\d+$/.test(exerciseIndex) ? Number(exerciseIndex) : -1;
  const practice = index >= 0 ? lesson.practice?.[index] : null;
  if (!practice) return { title:lesson.title,description:lesson.task,starter:lesson.starter,draftKey:lesson.id,index:-1 };
  const comment = practice.title.replace(/[\r\n]/g,' ');
  const starter = course.id === 'python'
    ? '# ' + comment + '\n# Алдымен есептің шешу қадамдарын ойластырып ал.\n\n'
    : 'public class Main {\n    public static void main(String[] args) {\n        // ' + comment + '\n        // Шешіміңді осы жерге жаз.\n    }\n}\n';
  return { ...practice,starter,draftKey:lesson.id + '::practice-' + index,index };
}
