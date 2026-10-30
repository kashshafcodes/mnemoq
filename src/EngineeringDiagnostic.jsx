import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { trackEvent } from './googleAnalytics';
import { DIAGNOSTIC_QUESTIONS, SUBJECT_ORDER } from './diagnosticQuestions';
import './EngineeringDiagnostic.css';

const LETTERS = ['A','B','C','D'];
const INITIAL_SECONDS = 30 * 60;

function calculateReport(answers) {
  const subject = {};
  const topics = {};
  for (const q of DIAGNOSTIC_QUESTIONS) {
    const correct = answers[q.id] === q.answer;
    subject[q.subject] ||= { correct: 0, total: 0 };
    subject[q.subject].total += 1;
    if (correct) subject[q.subject].correct += 1;
    topics[q.topic] ||= { subject: q.subject, correct: 0, total: 0, questionIds: [] };
    topics[q.topic].total += 1;
    topics[q.topic].questionIds.push(q.id);
    if (correct) topics[q.topic].correct += 1;
  }
  const topicRows = Object.entries(topics).map(([topic, value]) => ({ topic, ...value, percent: Math.round(value.correct / value.total * 100) }));
  const weakTopics = topicRows.filter((x) => x.percent < 50).sort((a,b) => a.percent-b.percent);
  const improveTopics = topicRows.filter((x) => x.percent >= 50 && x.percent < 75).sort((a,b) => a.percent-b.percent);
  return {
    score: DIAGNOSTIC_QUESTIONS.filter((q) => answers[q.id] === q.answer).length,
    total: DIAGNOSTIC_QUESTIONS.length,
    subject,
    topics: topicRows,
    weakTopics,
    improveTopics,
    answers,
  };
}

function getLevel(percent) {
  if (percent < 50) return { label: 'Priority area', tone: 'weak' };
  if (percent < 75) return { label: 'Needs practice', tone: 'medium' };
  return { label: 'On track', tone: 'strong' };
}

export default function EngineeringDiagnostic() {
  const [stage, setStage] = useState('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [report, setReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    document.title = 'Free Engineering Admission Diagnostic | Mnemoq';
    return () => { document.title = 'Mnemoq'; };
  }, []);
  const current = DIAGNOSTIC_QUESTIONS[index];

  useEffect(() => {
    if (stage !== 'test') return undefined;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === 'test' && secondsLeft === 0) {
      setReport(calculateReport(answers));
      trackEvent('diagnostic_completed', { test_code: 'engineering-diagnostic-v1', answered_count: Object.keys(answers).length, timed_out: true });
      setStage('capture');
    }
  }, [secondsLeft, stage, answers]);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((index + 1) / DIAGNOSTIC_QUESTIONS.length * 100);
  const computed = useMemo(() => report || calculateReport(answers), [report, answers]);

  function chooseAnswer(optionIndex) {
    setAnswers((old) => ({ ...old, [current.id]: optionIndex }));
  }
  function finishTest() {
    setReport(calculateReport(answers));
    trackEvent('diagnostic_completed', { test_code: 'engineering-diagnostic-v1', answered_count: Object.keys(answers).length });
    setStage('capture');
  }
  function startTest() {
    trackEvent('diagnostic_started', { test_code: 'engineering-diagnostic-v1' });
    setStage('test');
    setIndex(0);
    setAnswers({});
    setSecondsLeft(INITIAL_SECONDS);
    setReport(null);
    setError('');
  }
  async function unlockReport(event) {
    event.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    const finalReport = report || calculateReport(answers);
    const payload = {
      email: cleanEmail,
      name: name.trim() || null,
      test_code: 'engineering-diagnostic-v1',
      score: finalReport.score,
      total_questions: finalReport.total,
      subject_scores: finalReport.subject,
      topic_scores: finalReport.topics,
      answers: finalReport.answers,
      marketing_opt_in: marketingConsent,
      completed_at: new Date().toISOString(),
    };
    try {
      const { error: saveError } = await supabase.from('diagnostic_leads').insert(payload);
      if (saveError) throw saveError;
      trackEvent('diagnostic_lead_submitted', { test_code: 'engineering-diagnostic-v1', marketing_opt_in: marketingConsent });
      setReport(finalReport);
      setStage('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (saveError) {
      console.error('Diagnostic submission failed:', saveError);
      setError('We could not save your result. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="diag-page">
      <header className="diag-header">
        <a href="/" className="diag-brand"><img src="/mnemoq-logo.png" alt="Mnemoq" /><span>mnemoq</span></a>
        <span className="diag-header-tag">FREE ENGINEERING DIAGNOSTIC</span>
      </header>

      {stage === 'intro' && <section className="diag-hero">
        <div className="diag-hero-copy">
          <p className="diag-eyebrow">YOUR ADMISSION PREPARATION, MEASURED</p>
          <h1>Find your weak spots before the admission test.</h1>
          <p className="diag-lead">A 30-question engineering admission diagnostic to reveal which topics need your attention—not just how many questions you can answer.</p>
          <div className="diag-facts"><span>◷ 30 minutes</span><span>▦ 30 MCQs</span><span>◎ 4 subjects</span></div>
          <button className="diag-primary" onClick={startTest}>Start free diagnostic <span>→</span></button>
          <p className="diag-fine">No account required to take the test. Your email is requested only when you unlock your report.</p>
        </div>
        <div className="diag-preview-card">
          <div className="diag-preview-top"><span>YOUR PERSONAL REPORT</span><span className="diag-live-dot">● SAMPLE</span></div>
          <div className="diag-preview-score"><strong>21<span>/30</span></strong><small>Overall score</small></div>
          {['Higher Mathematics','Physics','Chemistry','English'].map((s, i) => <div className="diag-preview-row" key={s}><div><span>{s}</span><b>{[50,75,86,60][i]}%</b></div><div className="diag-track"><i style={{width:`${[50,75,86,60][i]}%`}} /></div></div>)}
          <div className="diag-preview-note"><b>What you'll discover</b><span>Specific topics to revise first, based on your answers.</span></div>
        </div>
      </section>}

      {stage === 'test' && <section className="diag-test-wrap">
        <div className="diag-test-heading"><div><p className="diag-eyebrow">ENGINEERING DIAGNOSTIC</p><h1>Question {index + 1} <span>of {DIAGNOSTIC_QUESTIONS.length}</span></h1></div><div className="diag-timer">◷ {String(Math.floor(secondsLeft/60)).padStart(2,'0')}:{String(secondsLeft%60).padStart(2,'0')} remaining</div></div>
        <div className="diag-progress"><i style={{width:`${progress}%`}} /></div>
        <div className="diag-test-layout">
          <article className="diag-question-card">
            <div className="diag-question-meta"><span>{current.subject}</span><span>{current.topic}</span><span>{current.difficulty}</span></div>
            <h2>{current.question}</h2>
            <div className="diag-options">{current.options.map((option, i) => <button key={option} className={`diag-option ${answers[current.id] === i ? 'selected' : ''}`} onClick={() => chooseAnswer(i)}><span>{LETTERS[i]}</span>{option}</button>)}</div>
            <div className="diag-question-actions"><button className="diag-secondary" disabled={index === 0} onClick={() => setIndex((x) => x-1)}>← Previous</button><span>{answeredCount} of 30 answered</span>{index < 29 ? <button className="diag-primary" onClick={() => setIndex((x) => x+1)}>Next question →</button> : <button className="diag-primary" onClick={finishTest}>Finish test →</button>}</div>
          </article>
          <aside className="diag-question-nav"><b>Question navigator</b><div>{DIAGNOSTIC_QUESTIONS.map((q, i) => <button key={q.id} className={`${index === i ? 'active' : ''} ${answers[q.id] !== undefined ? 'answered' : ''}`} onClick={() => setIndex(i)}>{i+1}</button>)}</div><p>Green = answered · Purple = current</p><button className="diag-finish-link" onClick={finishTest}>Finish and view report</button></aside>
        </div>
      </section>}

      {stage === 'capture' && <section className="diag-capture-wrap"><div className="diag-capture-card"><div className="diag-lock">✦</div><p className="diag-eyebrow">YOUR DIAGNOSTIC IS COMPLETE</p><h1>Your weak-topic breakdown is ready.</h1><p>Enter your email to unlock your personalised report, including subject scores and the exact topics that need more practice.</p><form onSubmit={unlockReport}><label htmlFor="diag-name">Name <small>(optional)</small></label><input id="diag-name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/><label htmlFor="diag-email">Email address</label><input id="diag-email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/><label className="diag-consent"><input type="checkbox" checked={marketingConsent} onChange={(e)=>setMarketingConsent(e.target.checked)}/><span>I'd also like to receive free study resources and occasional Mnemoq updates. (Optional)</span></label>{error && <p className="diag-error" role="alert">{error}</p>}<button className="diag-primary diag-full" disabled={submitting}>{submitting ? 'Unlocking your report…' : 'Unlock my weak-topic report →'}</button><p className="diag-privacy">Your email is used to save and unlock this report. Marketing emails are optional. We won't sell your information.</p></form><button className="diag-back-link" onClick={()=>setStage('test')}>← Review my answers</button></div></section>}

      {stage === 'results' && <section className="diag-results-wrap">
        <div className="diag-results-heading"><p className="diag-eyebrow">YOUR PERSONAL REPORT</p><h1>Your Engineering Diagnostic</h1><p>Use this report to decide what to revise next. Topic scores are based on a short screening test, so treat them as a starting point—not a definitive measure of mastery.</p></div>
        <div className="diag-score-card"><div><span>YOUR SCORE</span><strong>{computed.score}<small>/{computed.total}</small></strong><p>{Math.round(computed.score/computed.total*100)}% overall accuracy</p></div><div className="diag-score-message"><b>{computed.score/computed.total >= .8 ? 'Strong start.' : computed.score/computed.total >= .6 ? 'A workable foundation.' : 'You have clear opportunities to improve.'}</b><span>Focus on the topics below rather than studying everything equally.</span></div></div>
        <div className="diag-results-grid"><article className="diag-result-panel"><h2>Subject performance</h2>{SUBJECT_ORDER.map((s)=><div className="diag-result-subject" key={s}><div><b>{s}</b><span>{computed.subject[s].correct}/{computed.subject[s].total} correct · {Math.round(computed.subject[s].correct/computed.subject[s].total*100)}%</span></div><div className="diag-track"><i style={{width:`${computed.subject[s].correct/computed.subject[s].total*100}%`}}/></div></div>)}</article><article className="diag-result-panel"><h2>Topics to prioritise</h2>{computed.weakTopics.length === 0 && computed.improveTopics.length === 0 ? <p className="diag-result-empty">No topic fell below 75% in this short diagnostic. Try a longer subject-specific test to identify finer gaps.</p> : [...computed.weakTopics,...computed.improveTopics].slice(0,8).map((t)=><div className="diag-topic-row" key={t.topic}><div><b>{t.topic}</b><span>{t.subject} · {t.correct}/{t.total} correct</span></div><span className={`diag-status ${getLevel(t.percent).tone}`}>{getLevel(t.percent).label}</span></div>)}</article></div>
        <article className="diag-result-panel diag-all-topics"><div className="diag-panel-title"><h2>Complete topic breakdown</h2><button className="diag-secondary" onClick={()=>setReviewOpen(!reviewOpen)}>{reviewOpen?'Hide answer review':'Review answers'}</button></div>{computed.topics.map((t)=><div className="diag-topic-bar-row" key={t.topic}><div><b>{t.topic}</b><span>{t.subject}</span></div><div className="diag-topic-bar"><i className={getLevel(t.percent).tone} style={{width:`${t.percent}%`}}/></div><strong>{t.correct}/{t.total}</strong></div>)}</article>
        {reviewOpen && <article className="diag-result-panel diag-answer-review"><h2>Answer review</h2>{DIAGNOSTIC_QUESTIONS.map((q,i)=><div className="diag-answer-row" key={q.id}><b>{i+1}. {q.question}</b><span className={computed.answers[q.id] === q.answer ? 'correct':'incorrect'}>{computed.answers[q.id] === q.answer ? 'Correct' : `Your answer: ${computed.answers[q.id] === undefined ? 'Not answered' : q.options[computed.answers[q.id]]} · Correct: ${q.options[q.answer]}`}</span><p>{q.explanation}</p></div>)}</article>}
        <div className="diag-next-step"><div><p className="diag-eyebrow">TURN WEAK TOPICS INTO STRENGTHS</p><h2>Don't make the same mistake twice.</h2><p>Save the questions you struggled with in Mnemoq and revisit them using spaced repetition.</p></div><a href="/" className="diag-primary">Explore Mnemoq →</a></div>
        <button className="diag-back-link" onClick={()=>{setStage('intro');setReport(null);setAnswers({});}}>Take the diagnostic again</button>
      </section>}
      <footer className="diag-footer"><span>© {new Date().getFullYear()} Mnemoq</span><span>Learn from mistakes. Remember better.</span><a href="/">Go to Mnemoq</a></footer>
    </main>
  );
}
