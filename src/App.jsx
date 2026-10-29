
import { useEffect, useRef, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import Auth from './Auth';

import MnemoqLogo from './components/MnemoqLogo';
import Tutorial from './components/Tutorial';
import ReviewCard from './components/ReviewCard';
import Dashboard from './components/Dashboard';
import { DashboardIcon, HelpIcon, LibraryIcon, ReviewIcon } from './components/NavIcons';
import { ReviewSubjectTabs, SessionStart, SessionSummary } from './components/SessionPanels';
import { SESSION_SIZE, pickSessionCards, scheduleNext } from './quiz';
import QuickAdd from './components/QuickAdd';
import Pilot, { RecoveryPlan } from './components/Pilot';
import { LanguageToggle, useI18n } from './i18n';
import { loadPilot, savePilot } from './pilot';
import {
  SUBJECTS,
  DEFAULT_SUBJECT,
  canonicalCategory,
  canonicalSubject,
  getCategories,
  getSubjectNames,
  isReservedName,
  sameName,
  subjectAccent,
} from './subjects';

const STORAGE_KEY = 'mnemoq-mistakes';
const COLLAPSED_COUNT = 3;

const emptyForm = {
  subject: DEFAULT_SUBJECT,
  category: SUBJECTS[DEFAULT_SUBJECT][0],
  question: '',
  yourAnswer: '',
  correctAnswer: '',
  explanation: '',
};

function App() {
  useEffect(() => {
  async function testConnection() {
    const { error } = await supabase
      .from('mistakes')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('Supabase connection successful!');
    }
  }

  testConnection();
}, []);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const formRef = useRef(null);
  const [session, setSession] = useState(null);
const [authLoading, setAuthLoading] = useState(true);
  const [mistakes, setMistakes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // A short review session: the card ids picked at the start, plus how each went.
  const [reviewSession, setReviewSession] = useState(null);
  // Every rating ever given, newest last. It feeds the dashboard.
  const [reviewLog, setReviewLog] = useState([]);
  const historySavingOk = useRef(true);
  const [manualReviewId, setManualReviewId] = useState(null);
  // Which subject the review section is showing (null = all subjects mixed).
  const [reviewSubject, setReviewSubject] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [activeSubject, setActiveSubject] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { t } = useI18n();
  // First-run "Exam Debrief" pilot. `pilot` is the saved result (or null).
  const [pilot, setPilot] = useState(null);
  const [pilotOpen, setPilotOpen] = useState(false);
  const pilotChecked = useRef(null);

  // Decide once per account: brand-new people (no cards yet, pilot never seen)
  // get the guided first run. Everyone else just keeps their saved state.
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId || dataLoading || pilotChecked.current === userId) return;

    pilotChecked.current = userId;

    const saved = loadPilot(userId);

    setPilot(saved);

    if (!saved && mistakes.length === 0) setPilotOpen(true);
  }, [session, dataLoading, mistakes.length]);


  
useEffect(() => {
  if (!session?.user?.id) return;

  let cancelled = false;

  async function loadCloudMistakes() {
    setDataLoading(true);
    setDataError('');

    try {
      const { data: cloudRows, error } = await supabase
        .from('mistakes')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      if (cloudRows.length > 0) {
        const loadedMistakes = cloudRows.map((row) => ({
          id: row.id,
          subject: row.subject || DEFAULT_SUBJECT,
          category: row.category,
          question: row.question,
          yourAnswer: row.your_answer,
          correctAnswer: row.correct_answer,
          explanation: row.explanation,
          distractors: Array.isArray(row.distractors) ? row.distractors : [],
          createdAt: row.created_at,
          nextReviewAt: row.next_review_at,
          reviewCount: row.review_count,
          reviewIntervalDays: row.review_interval_days,
          mastered: row.mastered,
        }));

        if (!cancelled) setMistakes(loadedMistakes);
      } else {
        // The account has no cloud data yet.
        // Preserve and migrate this browser's existing mistakes.
        let localMistakes = [];

        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          localMistakes = saved ? JSON.parse(saved) : [];
        } catch {
          localMistakes = [];
        }

        if (!Array.isArray(localMistakes)) {
          localMistakes = [];
        }

        if (localMistakes.length > 0) {
          const rowsToInsert = localMistakes.map((mistake) => ({
            id: mistake.id,
            user_id: session.user.id,
            subject: mistake.subject || 'English',
            category: mistake.category || 'Vocabulary',
            question: mistake.question,
            your_answer: mistake.yourAnswer || '',
            correct_answer: mistake.correctAnswer || '',
            explanation: mistake.explanation || '',
            created_at: mistake.createdAt || new Date().toISOString(),
            next_review_at: mistake.nextReviewAt || null,
            review_count: mistake.reviewCount || 0,
            review_interval_days: mistake.reviewIntervalDays || 0,
            mastered: mistake.mastered || false,
          }));

          const { error: migrationError } = await supabase
            .from('mistakes')
            .upsert(rowsToInsert);

          if (migrationError) throw migrationError;
        }

        if (!cancelled) setMistakes(localMistakes);
      }
    } catch (error) {
      console.error('Could not load cloud mistakes:', error.message);

      if (!cancelled) {
        setDataError(error.message);
      }
    } finally {
      if (!cancelled) setDataLoading(false);
    }
  }

  loadCloudMistakes();

  return () => {
    cancelled = true;
  };
}, [session?.user?.id]);


// Review history for the dashboard. If the table isn't set up yet, the
// dashboard still works from the cards themselves.
useEffect(() => {
  const userId = session?.user?.id;

  if (!userId) {
    setReviewLog([]);
    return undefined;
  }

  let cancelled = false;

  async function loadReviewLog() {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, mistake_id, subject, category, rating, recalled, interval_days, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(5000);

    if (cancelled) return;

    if (error) {
      historySavingOk.current = false;
      console.warn('Review history is not available yet:', error.message);
      return;
    }

    historySavingOk.current = true;
    setReviewLog(
      (data || []).map((row) => ({
        id: String(row.id),
        cardId: String(row.mistake_id),
        subject: row.subject,
        category: row.category,
        rating: row.rating,
        recalled: Boolean(row.recalled),
        intervalDays: row.interval_days || 0,
        at: new Date(row.created_at),
      }))
    );
  }

  loadReviewLog();

  return () => {
    cancelled = true;
  };
}, [session?.user?.id]);

  
useEffect(() => {
  let isMounted = true;

  async function loadSession() {
    const { data, error } = await supabase.auth.getSession();

    if (!isMounted) return;

    if (error) {
      console.error('Could not load session:', error.message);
    }

    setSession(data?.session ?? null);
    setAuthLoading(false);
  }

  loadSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession);
    setAuthLoading(false);
  });

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);

  



  function selectSubject(subject) {
    setActiveSubject(subject);
    setActiveCategory('All');
    setShowAll(false);
  }

  function selectCategory(category) {
    setActiveCategory(category);
    setShowAll(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === 'subject') {
      // The subject box is "pick or type". When it becomes a known subject
      // and the current category doesn't belong to it, start from that
      // subject's first category. A brand-new subject keeps what's typed.
      setForm((previousForm) => {
        const known = getSubjectNames(mistakes).find((existing) =>
          sameName(existing, value)
        );
        const categories = known ? getCategories(known, mistakes) : [];
        const categoryFits = categories.some((existing) =>
          sameName(existing, previousForm.category)
        );

        return {
          ...previousForm,
          subject: value,
          category:
            known && !categoryFits ? categories[0] : previousForm.category,
        };
      });
      return;
    }

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

  

// Adds one rating to the history. The dashboard updates straight away; saving
// to the database happens in the background and never blocks reviewing.
async function recordReview(entry) {
  const at = new Date();

  setReviewLog((current) => [
    ...current,
    { ...entry, id: `local-${at.getTime()}-${current.length}`, at },
  ]);

  if (!historySavingOk.current) return;

  const { error } = await supabase.from('reviews').insert({
    user_id: session.user.id,
    mistake_id: String(entry.cardId),
    subject: entry.subject,
    category: entry.category,
    rating: entry.rating,
    recalled: entry.recalled,
    interval_days: entry.intervalDays,
  });

  if (error) {
    historySavingOk.current = false;
    console.warn('Could not save review history:', error.message);
  }
}

async function handleReviewRating(rating, result) {
  if (!reviewMistake) return;

  const userId = session?.user?.id;

  if (!userId) {
    setDataError('Please log in before reviewing a mistake.');
    return;
  }

  const now = new Date();
  const scheduled = scheduleNext(rating, reviewMistake.reviewIntervalDays, now);

  if (!scheduled) return;

  const nextReviewAt = scheduled.nextReviewAt;
  const nextIntervalDays = scheduled.intervalDays;

  const nextReviewAtISO = nextReviewAt.toISOString();
  const nextReviewCount = (reviewMistake.reviewCount || 0) + 1;
  const nextMastered =
    rating === 'good' || rating === 'easy'
      ? nextReviewCount >= 3
      : false;

  setDataError('');

  try {
    const { error } = await supabase
      .from('mistakes')
      .update({
        next_review_at: nextReviewAtISO,
        review_count: nextReviewCount,
        review_interval_days: nextIntervalDays,
        mastered: nextMastered,
      })
      .eq('id', reviewMistake.id)
      .eq('user_id', userId);

    if (error) throw error;

    setMistakes((currentMistakes) =>
      currentMistakes.map((mistake) =>
        mistake.id === reviewMistake.id
          ? {
              ...mistake,
              nextReviewAt: nextReviewAtISO,
              reviewCount: nextReviewCount,
              reviewIntervalDays: nextIntervalDays,
              mastered: nextMastered,
            }
          : mistake
      )
    );

    recordReview({
      cardId: reviewMistake.id,
      subject: reviewMistake.subject,
      category: reviewMistake.category,
      rating,
      recalled: result
        ? result === 'correct' || result === 'close'
        : rating === 'good' || rating === 'easy',
      intervalDays: nextIntervalDays,
    });

    if (manualReviewId !== null) {
      setManualReviewId(null);
    } else if (reviewSession) {
      setReviewSession((current) =>
        current
          ? {
              ...current,
              results: [
                ...current.results,
                {
                  id: reviewMistake.id,
                  rating,
                  recalled: result === 'correct' || result === 'close',
                },
              ],
            }
          : current
      );
    }
  } catch (error) {
    console.error('Could not save review rating:', error.message);
    setDataError(error.message);
  }
}






async function handleSubmit(event) {
  event.preventDefault();
  setDataError('');
  setFormError('');

  const userId = session?.user?.id;

  if (!userId) {
    setDataError('Please log in before saving a mistake.');
    return;
  }

  const isEditing = editingId !== null;
  const existingMistake = isEditing
    ? mistakes.find((mistake) => mistake.id === editingId)
    : null;

  const mistakeId = isEditing ? editingId : crypto.randomUUID();

  // Subject and category can be typed freely. Reuse the spelling of an
  // existing one so "chemistry" and "Chemistry" don't become two subjects.
  const subjectName =
    canonicalSubject(form.subject, mistakes) ||
    existingMistake?.subject ||
    DEFAULT_SUBJECT;
  const categoryName =
    canonicalCategory(subjectName, form.category, mistakes) ||
    getCategories(subjectName, mistakes)[0];

  // "All" is the name of the filter chip, so it can't also be a subject.
  if (isReservedName(subjectName) || isReservedName(categoryName)) {
    setFormError('"All" is used by the filters. Please choose a different name.');
    return;
  }

  const mistake = {
    id: mistakeId,
    user_id: userId,
    subject: subjectName,
    category: categoryName,
    question: form.question.trim(),
    your_answer: form.yourAnswer.trim(),
    correct_answer: form.correctAnswer.trim(),
    explanation: form.explanation.trim(),
    created_at: existingMistake?.createdAt || new Date().toISOString(),
    next_review_at: existingMistake?.nextReviewAt || null,
    review_count: existingMistake?.reviewCount || 0,
    review_interval_days: existingMistake?.reviewIntervalDays || 0,
    mastered: existingMistake?.mastered || false,
  };

  try {
    if (isEditing) {
      const { error } = await supabase
        .from('mistakes')
        .update(mistake)
        .eq('id', mistakeId)
        .eq('user_id', userId);

      if (error) throw error;

      setMistakes((current) =>
        current.map((item) =>
          item.id === mistakeId
            ? {
                ...item,
                subject: mistake.subject,
                category: mistake.category,
                question: mistake.question,
                yourAnswer: mistake.your_answer,
                correctAnswer: mistake.correct_answer,
                explanation: mistake.explanation,
              }
            : item
        )
      );

      setEditingId(null);
    } else {
      const { error } = await supabase
        .from('mistakes')
        .insert(mistake);

      if (error) throw error;

      const { user_id, ...savedMistake } = mistake;

      setMistakes((current) => [
        {
          id: savedMistake.id,
          subject: savedMistake.subject,
          category: savedMistake.category,
          question: savedMistake.question,
          yourAnswer: savedMistake.your_answer,
          correctAnswer: savedMistake.correct_answer,
          explanation: savedMistake.explanation,
          createdAt: savedMistake.created_at,
          nextReviewAt: savedMistake.next_review_at,
          reviewCount: savedMistake.review_count,
          reviewIntervalDays: savedMistake.review_interval_days,
          mastered: savedMistake.mastered,
        },
        ...current,
      ]);
    }

    setForm(emptyForm);
    setShowForm(false);
  } catch (error) {
    console.error('Could not save mistake:', error.message);
    setDataError(error.message);
  }
}


// Used by the quick-add panel. Saves one card and puts it at the top of the
// library. Returns { error } so the panel can show a message in place without
// replacing the whole screen.
async function addCard({
  subject,
  category,
  question,
  correctAnswer,
  yourAnswer,
  explanation,
  distractors = [],
}) {
  const userId = session?.user?.id;

  if (!userId) {
    return { error: 'Please log in before saving a card.' };
  }

  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    subject,
    category,
    question: question.trim(),
    your_answer: yourAnswer.trim(),
    correct_answer: correctAnswer.trim(),
    explanation: explanation.trim(),
    created_at: new Date().toISOString(),
    next_review_at: null,
    review_count: 0,
    review_interval_days: 0,
    mastered: false,
  };

  // Only sent when there are some, so normal cards keep saving even before
  // the optional "distractors" column exists in the database.
  if (distractors.length > 0) row.distractors = distractors;

  const { error } = await supabase.from('mistakes').insert(row);

  if (error) {
    console.error('Could not save card:', error.message);
    return { error: error.message };
  }

  setMistakes((current) => [
    {
      id: row.id,
      subject: row.subject,
      category: row.category,
      question: row.question,
      yourAnswer: row.your_answer,
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      distractors: row.distractors || [],
      createdAt: row.created_at,
      nextReviewAt: row.next_review_at,
      reviewCount: row.review_count,
      reviewIntervalDays: row.review_interval_days,
      mastered: row.mastered,
    },
    ...current,
  ]);

  return { error: '', id: row.id };
}


function handleEdit(mistake) {
  setForm({
    subject: mistake.subject || DEFAULT_SUBJECT,
    category: mistake.category,
    question: mistake.question,
    yourAnswer: mistake.yourAnswer,
    correctAnswer: mistake.correctAnswer,
    explanation: mistake.explanation,
  });

  setEditingId(mistake.id);
  setFormError('');
  setShowForm(true);
  requestAnimationFrame(() => {
  formRef.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
});
}


async function handleDelete(id) {
  const confirmed = window.confirm(
    'Are you sure you want to delete this mistake?'
  );

  if (!confirmed) return;

  const userId = session?.user?.id;

  if (!userId) {
    setDataError('Please log in before deleting a mistake.');
    return;
  }

  setDataError('');

  try {
    const { error } = await supabase
      .from('mistakes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    setMistakes((current) =>
      current.filter((mistake) => mistake.id !== id)
    );
  } catch (error) {
    console.error('Could not delete mistake:', error.message);
    setDataError(error.message);
  }
}



  // Built-in subjects plus any the person added themselves (read from their
  // cards). If the chosen filter no longer exists, fall back to "All".
  const subjectNames = getSubjectNames(mistakes);
  const subjectFilters = ['All', ...subjectNames];
  const subjectNow =
    subjectFilters.find((name) => sameName(name, activeSubject)) || 'All';

  const categoryFilters =
    subjectNow === 'All' ? [] : ['All', ...getCategories(subjectNow, mistakes)];
  const categoryNow =
    categoryFilters.find((name) => sameName(name, activeCategory)) || 'All';

const filteredMistakes = mistakes.filter(
  (mistake) =>
    (subjectNow === 'All' ||
      sameName(mistake.subject || DEFAULT_SUBJECT, subjectNow)) &&
    (categoryNow === 'All' || sameName(mistake.category, categoryNow))
);

const visibleMistakes = showAll
  ? filteredMistakes
  : filteredMistakes.slice(0, COLLAPSED_COUNT);

// Suggestions for the edit form's "pick or type" boxes.
const categorySuggestions = getCategories(form.subject, mistakes);


const now = new Date();


const dueMistakes = mistakes.filter((mistake) => {
  if (!mistake.nextReviewAt) return true;

  return new Date(mistake.nextReviewAt) <= now;
});

// ---- Short review sessions ----
// The next card of the session is the first picked card that hasn't been rated
// yet (and still exists, in case it was deleted meanwhile).
const ratedInSession = new Set(reviewSession ? reviewSession.results.map((entry) => entry.id) : []);
const nextSessionId = reviewSession
  ? reviewSession.ids.find(
      (id) => !ratedInSession.has(id) && mistakes.some((mistake) => mistake.id === id)
    )
  : undefined;
const sessionRunning = manualReviewId === null && nextSessionId !== undefined;
const sessionFinished = manualReviewId === null && reviewSession !== null && !sessionRunning;

// ---- Review sections per subject ----
// One tab per subject that has cards, each with its own due count. A subject
// that no longer has any cards falls back to "all subjects".
const cardSubject = (mistake) => mistake.subject || DEFAULT_SUBJECT;

const reviewTabs = getSubjectNames(mistakes)
  .map((name) => ({
    name,
    total: mistakes.filter((mistake) => sameName(cardSubject(mistake), name)).length,
    due: dueMistakes.filter((mistake) => sameName(cardSubject(mistake), name)).length,
  }))
  .filter((tab) => tab.total > 0);

const activeReviewSubject =
  reviewSubject && reviewTabs.some((tab) => sameName(tab.name, reviewSubject))
    ? reviewSubject
    : null;

const scopedDue = activeReviewSubject
  ? dueMistakes.filter((mistake) => sameName(cardSubject(mistake), activeReviewSubject))
  : dueMistakes;

function startSession() {
  const picked = pickSessionCards(scopedDue, SESSION_SIZE);

  if (picked.length === 0) return;

  setManualReviewId(null);
  setReviewSession({ ids: picked.map((card) => card.id), results: [] });
}

function chooseReviewSubject(name) {
  setReviewSubject(name);
  setReviewSession(null);
  setManualReviewId(null);
}

function endSession() {
  // Stop early: whatever was already rated goes into the summary.
  setReviewSession((current) =>
    current && current.results.length > 0
      ? { ...current, ids: current.results.map((entry) => entry.id) }
      : null
  );
}

function goToReview() {
  if (!sessionRunning) {
    // Coming from the dashboard or "Review now" after adding: if the chosen
    // subject has nothing due, review everything that is due instead.
    if (scopedDue.length === 0 && dueMistakes.length > 0) {
      const picked = pickSessionCards(dueMistakes, SESSION_SIZE);

      setReviewSubject(null);
      setManualReviewId(null);
      setReviewSession({ ids: picked.map((card) => card.id), results: [] });
    } else {
      startSession();
    }
  }

  requestAnimationFrame(() => {
    document.getElementById('review')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}




const reviewMistake =
  manualReviewId !== null
    ? mistakes.find((mistake) => mistake.id === manualReviewId) || null
    : sessionRunning
      ? mistakes.find((mistake) => mistake.id === nextSessionId) || null
      : null;

if (authLoading) {
  return (
    <main className="auth-page">
      <p>Loading Mnemoq...</p>
    </main>
  );
}

if (!session) {
  return <Auth />;
}

if (dataLoading) {
  return (
    <main className="auth-page">
      <p>Loading your mistakes...</p>
    </main>
  );
}

if (dataError) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h2>Couldn't load your mistakes</h2>
        <p role="alert">{dataError}</p>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    </main>
  );
}


  function finishPilot(result, thenReview) {
    const next = { status: 'done', ...result, hidden: false };

    savePilot(session.user.id, next);
    setPilot(next);
    setPilotOpen(false);

    if (thenReview) goToReview();
  }

  function leavePilot(status, openAdd) {
    const next = { status, cardIds: [], startedAt: new Date().toISOString(), hidden: true };

    // Never overwrite a finished debrief with a "skipped" one.
    if (!(pilot && pilot.status === 'done')) {
      savePilot(session.user.id, next);
      setPilot(next);
    }

    setPilotOpen(false);
    if (openAdd) setShowForm(true);
  }

  if (pilotOpen) {
    return (
      <Pilot
        cards={mistakes}
        addCard={addCard}
        onSkip={() => leavePilot('skipped', false)}
        onChooseOther={() => leavePilot('skipped', true)}
        onFinish={finishPilot}
      />
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <MnemoqLogo size={36} />
        <p className="nav-label">{t('nav.workspace')}</p>

        <nav>
          <a className="nav-item active" href="#dashboard">
            <DashboardIcon />
            <span>{t('nav.dashboard')}</span>
          </a>
          <a className="nav-item" href="#mistakes">
            <LibraryIcon />
            <span>{t('nav.library')}</span>
          </a>
          <a className="nav-item" href="#review">
            <ReviewIcon />
            <span>{t('nav.review')}</span>
          </a>
          <button
            type="button"
            className="nav-item nav-button"
            onClick={() => setShowTutorial(true)}
          >
            <HelpIcon />
            <span>{t('nav.how')}</span>
          </button>
          <button
            type="button"
            className="nav-item nav-button"
            onClick={() => setPilotOpen(true)}
          >
            <ReviewIcon />
            <span>{t('nav.debrief')}</span>
          </button>
        </nav>

        
<div className="sidebar-bottom">
  <p>{t('side.line1')}</p>
  <p>{t('side.line2')}</p>

  <LanguageToggle />

  <button
    type="button"
    className="logout-button"
    onClick={async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setDataError(error.message);
      } else {
        setMistakes([]);
        setManualReviewId(null);
        setReviewSession(null);
        setReviewLog([]);
        setPilot(null);
        setPilotOpen(false);
        pilotChecked.current = null;
      }
    }}
  >
    {t('nav.logout')}
  </button>
</div>

      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t('top.eyebrow')}</p>
            <h1>{t('top.title')}</h1>
            <p className="subtitle">
              {t('top.subtitle')}
            </p>
          </div>
          <div className="avatar">M</div>
        </header>

        {pilot && pilot.status === 'done' && !pilot.hidden && (
          <RecoveryPlan
            pilot={pilot}
            cards={mistakes}
            dueCount={dueMistakes.length}
            onReview={goToReview}
            onHide={() => {
              const next = { ...pilot, hidden: true };

              savePilot(session.user.id, next);
              setPilot(next);
            }}
          />
        )}

        <Dashboard
          cards={mistakes}
          reviews={reviewLog}
          dueCount={dueMistakes.length}
          showForm={showForm}
          onToggleAdd={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
              setForm(emptyForm);
            } else {
              setShowForm(true);
            }
          }}
          onReview={goToReview}
        />

        {showForm && editingId === null && (
          <QuickAdd
            cards={mistakes}
            onSave={addCard}
            onClose={() => setShowForm(false)}
            onReviewNow={() => {
              setShowForm(false);
              goToReview();
            }}
          />
        )}

        {showForm && editingId !== null && (
          <section ref={formRef} className="mistake-form-card">
            <h2>{editingId !== null ? 'Edit card' : 'Add a card'}</h2>
            <p className="subtitle">
              Only the question and correct answer are required.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="subject">
                Subject <span className="optional">(pick one or type your own)</span>
              </label>
              <input
                id="subject"
                name="subject"
                list="subject-suggestions"
                value={form.subject}
                onChange={handleChange}
                maxLength={40}
                autoComplete="off"
                required
              />
              <datalist id="subject-suggestions">
                {subjectNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <label htmlFor="category">
                Category <span className="optional">(pick one or type your own)</span>
              </label>
              <input
                id="category"
                name="category"
                list="category-suggestions"
                value={form.category}
                onChange={handleChange}
                maxLength={40}
                autoComplete="off"
                required
              />
              <datalist id="category-suggestions">
                {categorySuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <label htmlFor="question">Question or prompt</label>
              <textarea
                id="question"
                name="question"
                value={form.question}
                onChange={handleChange}
                placeholder="What do you want to remember?"
                required
              />

              <label htmlFor="correctAnswer">Correct answer</label>
              <input
                id="correctAnswer"
                name="correctAnswer"
                value={form.correctAnswer}
                onChange={handleChange}
                placeholder="What is the correct answer?"
                required
              />

              <label htmlFor="yourAnswer">
                Your incorrect answer <span className="optional">(optional)</span>
              </label>
              <input
                id="yourAnswer"
                name="yourAnswer"
                value={form.yourAnswer}
                onChange={handleChange}
                placeholder="If you got it wrong, what did you answer?"
              />

              <label htmlFor="explanation">
                Memory hook <span className="optional">(optional)</span>
              </label>
              <textarea
                id="explanation"
                name="explanation"
                value={form.explanation}
                onChange={handleChange}
                placeholder="A mnemonic, picture, or short reason that helps it stick"
              />

              {formError && (
                <p className="qa-message qa-error" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit">
                {editingId !== null ? 'Save changes' : 'Save card'}
              </button>
            </form>
          </section>
        )}

        



        
<section className="section-heading" id="mistakes">
  <h2>Your library</h2>
  <p className="subtitle">
    Everything you're learning, in one place.
  </p>
</section>

<div className="category-filters" aria-label="Filter cards by subject">
  {subjectFilters.map((subject) => (
    <button
      key={subject}
      type="button"
      className={
        subjectNow === subject
          ? 'filter-button selected'
          : 'filter-button'
      }
      style={
        subject === 'All' ? undefined : { '--accent': subjectAccent(subject) }
      }
      aria-pressed={subjectNow === subject}
      onClick={() => selectSubject(subject)}
    >
      {subject !== 'All' && (
        <span className="subject-dot" aria-hidden="true" />
      )}
      {subject}
    </button>
  ))}
</div>

{categoryFilters.length > 0 && (
  <div
    className="category-filters sub-filters"
    aria-label="Filter cards by category"
  >
    {categoryFilters.map((category) => (
      <button
        key={category}
        type="button"
        className={
          categoryNow === category
            ? 'filter-button selected'
            : 'filter-button'
        }
        aria-pressed={categoryNow === category}
        onClick={() => selectCategory(category)}
      >
        {category}
      </button>
    ))}
  </div>
)}


        
{filteredMistakes.length === 0 ? (
  <section className="empty-state">
    <div className="empty-icon">✳</div>
    <h3>
      {mistakes.length === 0
        ? 'Your journey starts with one card.'
        : 'No cards match this filter yet.'}
    </h3>
    <p>
      {mistakes.length === 0
        ? 'Add something you want to remember, or something you got wrong, to begin your library.'
        : 'Choose another subject or category, or add a card here.'}
    </p>
    {mistakes.length === 0 && (
      <button
        type="button"
        className="text-link"
        onClick={() => setShowTutorial(true)}
      >
        New here? See how it works
      </button>
    )}
  </section>
) : (
  <section className="mistake-list">
    {visibleMistakes.map((mistake) => (
      <article
        className="mistake-card accented"
        key={mistake.id}
        style={{ '--accent': subjectAccent(mistake.subject) }}
      >
        <div className="mistake-card-top">
          <span className="subject-tag">
            <span className="subject-dot" aria-hidden="true" />
            {mistake.subject}
          </span>
          <span className="category-tag">
            {mistake.category}
          </span>
        </div>

        <h3>{mistake.question}</h3>
        {mistake.yourAnswer && (
          <p>
            <strong>Your answer:</strong> {mistake.yourAnswer}
          </p>
        )}
        <p>
          <strong>Correct answer:</strong>{' '}
          <span className="correct-text">{mistake.correctAnswer}</span>
        </p>
        {mistake.explanation && (
          <p className="explanation">
            <strong>Memory hook:</strong> {mistake.explanation}
          </p>
        )}

        <div className="mistake-actions">
          
<button
  className="secondary-button"
  onClick={() => {
    setManualReviewId(mistake.id);
    document.getElementById('review')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }}
>
  Review now
</button>

          <button
            type="button"
            onClick={() => handleEdit(mistake)}
          >
            Edit
          </button>
          <button
            type="button"
            className="delete-button"
            onClick={() => handleDelete(mistake.id)}
          >
            Delete
          </button>
        </div>
      </article>
    ))}

    {filteredMistakes.length > COLLAPSED_COUNT && (
      <div className="see-all-row">
        <button
          type="button"
          className="see-all-button"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? 'Show fewer'
            : `See all ${filteredMistakes.length} cards`}
        </button>
      </div>
    )}
  </section>
)}

<section className="review-section" id="review">
  <div className="section-heading">
    <div>
      <p className="eyebrow">ACTIVE RECALL</p>
      <h2>Review your cards</h2>
      <p>Pick or type your answer first. Recalling it beats re-reading it.</p>
    </div>
  </div>

  {!reviewMistake && !sessionFinished && (
    <ReviewSubjectTabs
      tabs={reviewTabs}
      active={activeReviewSubject}
      totalDue={dueMistakes.length}
      onChange={chooseReviewSubject}
    />
  )}

{reviewMistake ? (
  <>
    {sessionRunning && (
      <div className="session-bar">
        <span>
          {activeReviewSubject ? `${activeReviewSubject} session` : 'Short session'}
        </span>
        <button type="button" className="text-link" onClick={endSession}>
          End session
        </button>
      </div>
    )}
    <ReviewCard
      key={`${reviewMistake.id}-${reviewMistake.reviewCount || 0}`}
      card={reviewMistake}
      cards={mistakes}
      position={{
        index: manualReviewId !== null ? 0 : reviewSession.results.length,
        total: manualReviewId !== null ? 1 : reviewSession.ids.length,
      }}
      onRate={handleReviewRating}
    />
  </>
) : sessionFinished ? (
  <SessionSummary
    results={reviewSession.results}
    cards={mistakes}
    moreDue={scopedDue.length}
    onAgain={startSession}
    onDone={() => setReviewSession(null)}
  />
) : scopedDue.length > 0 ? (
  <SessionStart
    dueCards={scopedDue}
    subject={activeReviewSubject}
    sessionSize={SESSION_SIZE}
    onStart={startSession}
  />
) : (
  <div className="review-empty-state">
    <h3>
      {activeReviewSubject
        ? `${activeReviewSubject} is all caught up!`
        : "You're all caught up!"}
    </h3>
    <p>
      {activeReviewSubject
        ? `No ${activeReviewSubject} cards are due right now.`
        : 'No cards are due for review right now.'}
    </p>
    <p>
      {activeReviewSubject
        ? dueMistakes.length > 0
          ? 'Pick another subject above to keep going.'
          : "They'll return to your review queue when they're due."
        : `You have ${mistakes.length} saved card${mistakes.length === 1 ? '' : 's'} in your library. They'll return to your review queue when they're due.`}
    </p>
  </div>
)}
</section>

      </main>

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

export default App;

