
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import Landing from './components/Landing';
import { clearGuestResult, pendingGuestResult } from './guestResult';
import { clearSampleMisses, pendingSampleCards, readSampleMisses } from './sample/store';
import { trackEvent } from './googleAnalytics';

import { MnemoqMark } from './components/MnemoqLogo';
import Tutorial from './components/Tutorial';
import PageErrorBoundary from './components/PageErrorBoundary';
import { checkAdmin, identify, trackPage } from './track';
import DueBadge from './components/DueBadge';
import { SUBJECT_CATALOG, getPath, scaleOf } from './paths';
import { FREE_PLAN, loadPlan } from './plan';
import { deleteQuestion, saveMock, saveQuestions } from './mockStore';
import { loadPathState, saveAnalysis, saveDiagnostic, savePath } from './pathStore';
import { requestAnalysis } from './coachApi';
import { analysisPayload, daysLeftFor, describeProgress, readinessFor } from './readiness';
import { readProfile } from './profile';
import Home from './components/Home';
import LibraryPage, { COLLAPSED_COUNT } from './components/LibraryPage';
import ReviewPage from './components/ReviewPage';
import { ExamSegments, MobileBar, Sidebar, TabBar, navItems } from './components/AppNav';
import { pageHref, useRoute } from './useRoute';
import { SESSION_SIZE, pickSessionCards, scheduleNext } from './quiz';
import { RecoveryPlan } from './components/RecoveryPlan';
import { useI18n } from './i18n';
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
} from './subjects';
// Loaded after every component's own styles so the new look has the final say.
import './polish.css';
import PageLoading from './components/PageLoading';
import { computeStreaks } from './analytics';
import { streakTimes } from './streak/activity';
import { noteLearning } from './sync/queue';
import { pullDays, startSync } from './sync/sync';
import { dailyStatus } from './daily/DailyTile';
import PlayButton from './loop/PlayButton';
import { roundMusic } from './sensory';
import TodayRound from './loop/TodayRound';
import { stepLabelKey, useRound } from './loop/useRound';
import { loopT } from './loop/strings';
import MeExtras from './nav/MeExtras';
import { navT } from './nav/strings';
import { track } from './track';
import { pickNewMisses, readKept, writeKept } from './practice/missCards';

// Pages that are not the first screen load on demand (smaller first download).
const TryDiagnostic = lazy(() => import('./components/TryDiagnostic'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminStats = lazy(() => import('./components/AdminStats'));
const Practice = lazy(() => import('./components/Practice'));
const DiagnosticReport = lazy(() => import('./components/DiagnosticReport'));
const MockCenter = lazy(() => import('./components/MockCenter'));
const PathPage = lazy(() => import('./components/PathPage'));
const ProPage = lazy(() => import('./components/Pro'));
const Profile = lazy(() => import('./components/Profile'));
const SnapSheet = lazy(() => import('./snap/SnapSheet'));
const Daily = lazy(() => import('./daily/Daily.jsx'));
const DoneToday = lazy(() => import('./loop/DoneToday'));
const Pilot = lazy(() => import('./components/Pilot'));
const Drill = lazy(() => import('./loop/Drill'));

const STORAGE_KEY = 'mnemoq-mistakes';


const emptyForm = {
  subject: DEFAULT_SUBJECT,
  category: SUBJECTS[DEFAULT_SUBJECT][0],
  question: '',
  yourAnswer: '',
  correctAnswer: '',
  explanation: '',
};

function App() {
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const formRef = useRef(null);
  const { page, sub, go } = useRoute();
  // Music lives only inside Today's round (review, drill, the Daily, done).
  // Any other page ends it (a fade, never a cut); review is pad only.
  useEffect(() => {
    if (page === 'done') roundMusic.resolve(); // the home chord, a 3 s fade
    else if (!['review', 'drill', 'daily'].includes(page)) roundMusic.stop();
    else roundMusic.setMode(page === 'review' ? 'review' : 'play');
  }, [page]);
  // mnemoq.../sat or .../nsu: the diagnostic anyone can take before signing up.
  const [tryExam] = useState(() => {
    const match = /^\/(sat|nsu|brac)\/?$/i.exec(window.location.pathname);

    return match ? match[1].toLowerCase() : null;
  });
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
  const { t, lang } = useI18n();
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

    // People who arrive with a diagnostic result go straight to it instead.
    if (!saved && (tryExam || pendingGuestResult(session.user) || pendingSampleCards(session.user).length > 0)) {
      const skipped = { status: 'skipped' };

      savePilot(userId, skipped);
      setPilot(skipped);
      return;
    }

    if (!saved && mistakes.length === 0) setPilotOpen(true);
  }, [session, dataLoading, mistakes.length, tryExam]);

  // The student's exam path and latest diagnostic (Supabase).
  const [pathState, setPathState] = useState({ status: 'loading', path: null, diagnostic: null });

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setPathState({ status: 'loading', path: null, diagnostic: null });
      return undefined;
    }

    let cancelled = false;

    loadPathState(userId).then((next) => {
      if (!cancelled) setPathState({ path: null, diagnostic: null, ...next });
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Visitor and activity tracking (src/track.js): one page view per page, tied
  // to the account once signed in. `isAdmin` unlocks the Stats page.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (session?.user?.id) trackPage(sub ? `${page}/${sub}` : page);
  }, [page, sub, session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setIsAdmin(false);
      return undefined;
    }

    let cancelled = false;

    identify(userId);
    checkAdmin().then((yes) => {
      if (!cancelled) setIsAdmin(yes);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // A diagnostic taken before signing up (TryDiagnostic.jsx): save it to the
  // account once, choose that exam's path, and open it.
  const importingGuest = useRef(false);
  const [freshReport, setFreshReport] = useState(false);

  useEffect(() => {
    const user = session?.user;

    if (!user || dataLoading || pathState.status !== 'ready' || importingGuest.current) return;

    const pending = pendingGuestResult(user);

    if (!pending) {
      if (tryExam) {
        window.history.replaceState(null, '', '/');
        go('exam');
      }
      return;
    }

    importingGuest.current = true;

    (async () => {
      const { exam, result } = pending;
      const config = getPath(exam);

      if (!config) return;

      if (pathState.path?.pathId !== exam) {
        const saved = await savePath(user.id, { pathId: exam, examDate: null, target: config.target });

        if (saved.error) {
          importingGuest.current = false;
          return;
        }
      }

      const kind = pathState.path?.pathId === exam && pathState.diagnostic ? 'retest' : 'initial';
      const diag = await saveDiagnostic(user.id, { pathId: exam, kind, sections: result.sections, essay: null, analysis: null });

      if (diag.error) {
        importingGuest.current = false;
        return;
      }

      await clearGuestResult(user);
      trackEvent('diagnostic_done', { path: exam, kind: 'guest' });
      setPathState({ path: null, diagnostic: null, ...(await loadPathState(user.id)) });
      window.history.replaceState(null, '', '/');
      setFreshReport(true);
      go('exam/report');
    })();
  }, [session, dataLoading, pathState, tryExam, go]);

  // Misses from the sample round played before signing up (src/sample/):
  // they become this account's first review cards, once.
  const importingSample = useRef(false);

  useEffect(() => {
    const user = session?.user;

    if (!user || dataLoading || importingSample.current) return;

    const local = readSampleMisses();
    const cards = pendingSampleCards(user);

    if (cards.length === 0) return;

    importingSample.current = true;

    // Already imported on another device (the sign-up copy was cleared there).
    if (local && user.user_metadata?.sample_imported_at === local.at && !user.user_metadata?.sample_misses) {
      clearSampleMisses();
      return;
    }

    (async () => {
      let added = 0;

      for (const card of cards) {
        // eslint-disable-next-line no-await-in-loop
        const result = await addCard(card);

        if (!result?.error) added += 1;
      }

      const at = local?.at || user.user_metadata?.sample_misses?.at || null;

      clearSampleMisses();
      await supabase.auth.updateUser({ data: { sample_misses: null, sample_imported_at: at } }).catch(() => {});
      trackEvent('sample_cards_saved', { count: added });
    })();
  }, [session, dataLoading]);

  // Mnemoq Pro: the person's plan (supabase/stage5.sql).
  const [plan, setPlan] = useState(FREE_PLAN);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setPlan(FREE_PLAN);
      return undefined;
    }

    let cancelled = false;

    loadPlan(userId).then((next) => {
      if (!cancelled) setPlan(next);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);


  
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


// Account sync (src/sync/): learning days, Daily results and the app
// language, while signed in. Declared before the review log so its pull of
// the account's days has started when the log loads.
useEffect(() => startSync(supabase, session?.user?.id), [session?.user?.id]);

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
    // The account's learning days arrive with the log, so the first streak
    // shown already counts other devices.
    const [{ data, error }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, mistake_id, subject, category, rating, recalled, interval_days, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(5000),
      pullDays(userId),
    ]);

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
  noteLearning('review', at);

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
    return false;
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

    trackEvent('review_completed', {
      review_mode: manualReviewId !== null ? 'manual' : 'session',
      rating,
      recalled: result ? (result === 'correct' || result === 'close') : (rating === 'good' || rating === 'easy'),
    });

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
    return true;
  } catch (error) {
    console.error('Could not save review rating:', error.message);
    setDataError(error.message);
    return false;
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

      trackEvent('mistake_saved', { method: 'library_form' });
      if (mistakes.length === 0) trackEvent('first_mistake_saved', { method: 'library_form' });

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
  nextReviewAt = null,
  method = 'quick_add',
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
    next_review_at: nextReviewAt,
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

  trackEvent('mistake_saved', { method });
  if (mistakes.length === 0) trackEvent('first_mistake_saved', { method });

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

// Used by Snap: change a card it just saved (Edit), or take it back (Undo,
// no confirm: the person pressed Undo a moment after saving).
async function updateCard(id, { subject, category, question, correctAnswer, yourAnswer, explanation, distractors }) {
  const userId = session?.user?.id;

  if (!userId) return { error: 'Please log in first.' };

  const row = {
    subject,
    category,
    question: question.trim(),
    your_answer: yourAnswer.trim(),
    correct_answer: correctAnswer.trim(),
    explanation: explanation.trim(),
  };

  if (distractors?.length > 0) row.distractors = distractors;

  const { error } = await supabase.from('mistakes').update(row).eq('id', id).eq('user_id', userId);

  if (error) return { error: error.message };

  setMistakes((current) =>
    current.map((item) =>
      item.id === id
        ? { ...item, subject, category, question: row.question, yourAnswer: row.your_answer, correctAnswer: row.correct_answer, explanation: row.explanation, distractors: row.distractors || item.distractors }
        : item
    )
  );

  return { error: '' };
}

async function removeCard(id) {
  const userId = session?.user?.id;

  if (!userId) return { error: 'Please log in first.' };

  const { error } = await supabase.from('mistakes').delete().eq('id', id).eq('user_id', userId);

  if (error) return { error: error.message };

  setMistakes((current) => current.filter((item) => item.id !== id));

  return { error: '' };
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

  go('review');
}

// Saves cards (the Daily's misses) and starts a review of exactly those.
async function saveAndReview(list) {
  const ids = [];

  for (const card of list) {
    // eslint-disable-next-line no-await-in-loop
    const result = await addCard(card);

    if (result?.error) return { error: result.error, saved: ids.length };

    ids.push(result.id);
  }

  if (ids.length > 0) {
    setReviewSubject(null);
    setManualReviewId(null);
    setReviewSession({ ids, results: [] });
    go('review');
  }

  return { saved: ids.length };
}

const reviewMistake =
  manualReviewId !== null
    ? mistakes.find((mistake) => mistake.id === manualReviewId) || null
    : sessionRunning
      ? mistakes.find((mistake) => mistake.id === nextSessionId) || null
      : null;

  // A short summary of the path for the home page and the review page.
  const pathCfg = pathState.status === 'ready' ? pathState.path : null;
  const pathInfo = pathCfg
    ? (() => {
        const config = getPath(pathCfg.pathId);
        const readiness = readinessFor(pathCfg.pathId, pathState.diagnostic, reviewLog, new Date(), pathState.mocks || []);
        const daysLeft = daysLeftFor(pathCfg.examDate);
        const scale = scaleOf(config);

        return {
          name: config.name,
          short: config.short,
          daysLeft,
          engine: config.engine || 'classic',
          word: scale.word,
          readiness: readiness.overall,
          target: pathCfg.target,
          progress: describeProgress(readiness.overall, pathCfg.target, daysLeft, scale),
          weakest: readiness.weakest,
          // A logged score is as good a starting point as a diagnostic.
          hasDiagnostic: Boolean(pathState.diagnostic) || readiness.overall !== null,
        };
      })()
    : null;

  // Today's round (src/loop/): due cards, then the Daily, then the weakest-skill
  // drill. Hooks run before the early returns below.
  const round = useRound({
    userId: session?.user?.id || null,
    cards: mistakes,
    dueCards: dueMistakes,
    reviews: reviewLog,
    weakest: pathInfo?.weakest || null,
    ready: Boolean(session?.user?.id) && !dataLoading && pathState.status !== 'loading',
    pro: Boolean(plan.pro),
    size: SESSION_SIZE,
  });

if (authLoading) {
  return (
    <main className="mq-loading" aria-busy="true">
      <MnemoqMark size={44} />
      <p>Loading Mnemoq…</p>
    </main>
  );
}

if (!session) {
  return tryExam ? <TryDiagnostic exam={tryExam} /> : <Landing />;
}

if (dataLoading) {
  return (
    <main className="mq-loading" aria-busy="true">
      <MnemoqMark size={44} />
      <p>Getting your cards ready…</p>
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


  async function logOut() {
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
  }

  // Name and avatar colour live on the account (Supabase user metadata).
  async function saveProfile({ name, color }) {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: name, avatar_color: color },
    });

    if (error) return { error: error.message };

    if (data?.user) setSession((current) => (current ? { ...current, user: data.user } : current));

    return { error: '' };
  }

  const me = readProfile(session?.user);

  async function reloadPath() {
    setPathState({ status: 'loading', path: null, diagnostic: null });
    setPathState({ path: null, diagnostic: null, ...(await loadPathState(session.user.id)) });
  }

  // Saves a path and makes it the active one. Choosing a different exam
  // loads that exam's own diagnostic and results.
  async function choosePath(choice) {
    const changed = pathState.path?.pathId !== choice.pathId;
    const result = await savePath(session.user.id, choice);

    if (result.error) return { error: result.error };

    if (changed) {
      setPathState({ path: null, diagnostic: null, ...(await loadPathState(session.user.id)) });
    } else {
      setPathState((current) => ({
        ...current,
        path: result.path,
        paths: (current.paths || []).map((p) => (p.pathId === result.path.pathId ? result.path : p)),
      }));
    }

    trackEvent('path_saved', { path: result.path.pathId });

    return {};
  }

  // Switches to another exam the person already follows, keeping its date and target.
  const switchPath = (other) => choosePath({ pathId: other.pathId, examDate: other.examDate, target: other.target });

  async function recordDiagnostic(result) {
    const saved = await saveDiagnostic(session.user.id, {
      pathId: pathState.path.pathId,
      kind: result.kind,
      sections: result.sections,
      essay: result.essay,
      analysis: result.analysis,
    });

    if (saved.error) return { error: saved.error };

    setPathState((current) => ({ ...current, diagnostic: saved.diagnostic }));
    trackEvent('diagnostic_done', { path: pathState.path.pathId, kind: result.kind });

    return {};
  }

  async function rerunAnalysis() {
    const { path, diagnostic } = pathState;

    try {
      const data = await requestAnalysis(analysisPayload(path.pathId, diagnostic, path.examDate, path.target));
      const saved = await saveAnalysis(diagnostic.id, data.analysis);

      setPathState((current) => ({ ...current, diagnostic: { ...current.diagnostic, analysis: data.analysis } }));

      return saved.error ? { error: `The analysis ran but could not be saved: ${saved.error}` } : {};
    } catch (caught) {
      return { error: caught?.message || 'The AI analysis could not run.', code: caught?.code || 'failed' };
    }
  }

  // Keeps missed practice-library and drill questions as review cards, due
  // now (src/practice/missCards.js): at most 10 per session, never the same
  // question twice. Returns the new card ids so "Don't keep these" can undo.
  async function addPracticeCards(list) {
    const userId = session?.user?.id;

    if (!userId) return { added: 0, ids: [], error: 'Please log in to keep your misses as cards.' };

    const kept = readKept(userId);
    const fresh = pickNewMisses(list, kept, mistakes);
    const ids = [];

    for (const { sourceId, ...card } of fresh) {
      // eslint-disable-next-line no-await-in-loop
      const result = await addCard(card);

      if (result?.error) return { added: ids.length, ids, error: result.error };

      ids.push(result.id);
      writeKept(userId, { [sourceId]: result.id });
    }

    return { added: ids.length, ids };
  }

  // "Don't keep these": removes the cards a practice set just kept.
  async function removePracticeCards(ids) {
    const userId = session?.user?.id;

    if (!userId) return { error: 'Please log in first.' };

    const { error } = await supabase.from('mistakes').delete().in('id', ids).eq('user_id', userId);

    if (error) return { error: error.message };

    const gone = new Set(ids);
    const kept = readKept(userId);

    writeKept(userId, Object.fromEntries(Object.entries(kept).filter(([, cardId]) => gone.has(cardId)).map(([sourceId]) => [sourceId, null])));
    setMistakes((current) => current.filter((item) => !gone.has(item.id)));

    return { error: '' };
  }

  // Turns missed diagnostic questions into review cards (with their wrong options for multiple choice).
  async function addDiagnosticCards(list) {
    let added = 0;

    for (const item of list) {
      // eslint-disable-next-line no-await-in-loop
      const result = await addCard({
        subject: item.subject || SUBJECT_CATALOG[item.sectionId]?.cardSubject || 'English',
        category: String(item.topic || 'Diagnostic').slice(0, 40),
        question: item.question,
        correctAnswer: item.correctAnswer,
        yourAnswer: item.yourAnswer,
        explanation: item.explain || '',
        distractors: item.distractors,
      });

      if (result?.error) return { added, error: result.error };

      added += 1;
    }

    return { added };
  }

  async function recordMock(record) {
    const saved = await saveMock(session.user.id, record);

    if (saved.error) return { error: saved.error };

    setPathState((current) => ({ ...current, mocks: [saved.mock, ...(current.mocks || [])] }));
    trackEvent('mock_done', { path: record.pathId });

    return {};
  }

  async function addBankQuestions(sectionId, list) {
    const saved = await saveQuestions(session.user.id, pathState.path.pathId, sectionId, list);

    if (saved.error) return { error: saved.error };

    setPathState((current) => ({ ...current, bank: [...(current.bank || []), ...saved.questions] }));

    return {};
  }

  async function removeBankQuestion(id) {
    const result = await deleteQuestion(id);

    if (!result.error) setPathState((current) => ({ ...current, bank: (current.bank || []).filter((q) => q.id !== id) }));
  }

  function reviewSubjectFromPath(subject) {
    const tab = reviewTabs.find((t) => sameName(t.name, subject));

    if (tab) chooseReviewSubject(tab.name);

    go('review');
  }

  const nav = navItems({ t: navT(lang), dueCount: dueMistakes.length });

  function finishPilot(result, thenReview) {
    const next = { status: 'done', ...result, hidden: false };

    trackEvent('pilot_done');

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
    if (openAdd) go('snap');
  }

  if (pilotOpen) {
    return (
      <Suspense fallback={<PageLoading />}>
      <Pilot
        cards={mistakes}
        addCard={addCard}
        onSkip={() => leavePilot('skipped', false)}
        onChooseOther={() => leavePilot('skipped', true)}
        onChoosePath={() => {
          leavePilot('skipped', false);
          go('exam');
        }}
        onFinish={finishPilot}
      />
      </Suspense>
    );
  }

  // Today's loop: the round's Play button, shared by Today, the end of a
  // round, the Daily and "Done for today".
  const lt = loopT(lang);
  const { plan: roundNow, play } = round;
  const dailyPlayed = Boolean(dailyStatus().today);

  function playNow() {
    if (play.action === 'none') return;
    // Today's round has begun: the quiet music bed may play (Music switch).
    if (play.action !== 'done') roundMusic.start({ mode: play.action === 'review' ? 'review' : 'play' });
    if (play.action !== 'done') track('round_step_start', { step: roundNow.current, n: play.n, from: 'play' });

    if (play.action === 'review') goToReview();
    else go(play.action);
  }

  // After a step: back to Today (the ring shows the step lit and Play names
  // the next one), or "Done for today" once every step is finished.
  function backToRound() {
    go(round.planNow().allDone ? 'done' : 'today');
  }

  // "Next: {step}" at the end of a step opens that step straight away.
  function continueRound() {
    const next = round.planNow();

    if (next.allDone || !next.current || next.current === 'cards') {
      backToRound();
      return;
    }

    track('round_step_start', { step: next.current, from: 'link' });
    go(next.current);
  }

  const roundNext = {
    allDone: roundNow.allDone,
    label: roundNow.allDone
      ? lt('session.next.done')
      : roundNow.current && roundNow.current !== 'cards'
        ? lt('round.next', { step: lt(stepLabelKey(roundNow.current)) })
        : lt('round.continue'),
    onContinue: continueRound,
  };

  function anotherRound() {
    round.noteExtra();
    goToReview();
  }

  // The Daily inside the app: full screen, the night look, a back button, no reload.
  if (page === 'daily') {
    return (
      <PageErrorBoundary page="daily">
        <Suspense fallback={<PageLoading />}>
          <Daily
            inApp={{
              onBack: () => go('today'),
              streakNow: () => computeStreaks(reviewLog, new Date(), streakTimes()).current,
              dueCount: dueMistakes.length,
              onReview: goToReview,
              onDone: backToRound,
              onSaveAndReview: saveAndReview,
            }}
          />
        </Suspense>
      </PageErrorBoundary>
    );
  }

  // Review and the drill: full-screen flows opened by Play, one way out.
  if (page === 'review' || page === 'drill') {
    return (
      <div className="mq-flow">
        <header className="mq-flow-bar">
          <a className="mq-flow-close" href={pageHref('today')} aria-label={lt('done.home')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </a>
          <span className="mq-flow-title">{lt('round.title')}</span>
        </header>
        <main className="mq-flow-body">
          <PageErrorBoundary key={page} page={page}>
            <Suspense fallback={<PageLoading />}>
              {page === 'review' ? (
                <ReviewPage
                  pathInfo={pathInfo}
                  reviewMistake={reviewMistake}
                  sessionFinished={sessionFinished}
                  reviewTabs={reviewTabs}
                  activeReviewSubject={activeReviewSubject}
                  reviewSubjectFromPath={reviewSubjectFromPath}
                  dueMistakes={dueMistakes}
                  chooseReviewSubject={chooseReviewSubject}
                  sessionRunning={sessionRunning}
                  endSession={endSession}
                  mistakes={mistakes}
                  manualReviewId={manualReviewId}
                  reviewSession={reviewSession}
                  handleReviewRating={handleReviewRating}
                  scopedDue={scopedDue}
                  startSession={startSession}
                  setReviewSession={setReviewSession}
                  dailyPlayed={dailyPlayed}
                  go={go}
                  roundNext={roundNext}
                />
              ) : round.drill ? (
                <Drill source={round.drill} onFinish={round.markDrillDone} onDone={continueRound} onLeave={() => go('today')} onAddCards={addPracticeCards} onRemoveCards={removePracticeCards} />
              ) : (
                <DoneToday cards={mistakes} play={play} onPlay={playNow} userId={session.user.id} plan={roundNow} dueCount={dueMistakes.length} onExtra={anotherRound} />
              )}
            </Suspense>
          </PageErrorBoundary>
        </main>
      </div>
    );
  }

  // Exam: Path (default) · Mock tests · Practice, plus the full report page.
  const examView = page === 'exam' ? sub || 'path' : null;

  return (
    <div className="mq-app">
      <DueBadge count={dueMistakes.length} />
      <Sidebar
        page={page}
        items={nav.side}
        plan={plan}
        me={me}
        onLogout={logOut}
      />
      <MobileBar page={page} me={me} />
      <TabBar page={page} items={nav.tabs} />

      {page === 'today' && <PlayButton state={play} onPlay={playNow} />}

      <main className="mq-main">
        <PageErrorBoundary key={page} page={page}>
        <Suspense fallback={<PageLoading />}>
        {page === 'today' && (
          <>
        <header className="mq-greeting">
          <p className="mq-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{me.name ? `${t('top.title').replace(/[.।]$/, '')}, ${me.name}.` : t('top.title')}</h1>
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

            <TodayRound round={round} dueCount={dueMistakes.length} />

            <Home
              cards={mistakes}
              reviews={reviewLog}
              dueCount={dueMistakes.length}
              onReview={goToReview}
              pathInfo={pathInfo}
              pathLoading={pathState.status === 'loading'}
              userId={session.user.id}
              play={play}
              onPlay={playNow}
            />
          </>
        )}

        {page === 'done' && (
          <DoneToday cards={mistakes} play={play} onPlay={playNow} userId={session.user.id} plan={roundNow} dueCount={dueMistakes.length} onExtra={anotherRound} />
        )}

        {page === 'progress' && (
          <Dashboard
            cards={mistakes}
            reviews={reviewLog}
            dueCount={dueMistakes.length}
            showForm={false}
            onToggleAdd={() => go('snap')}
            onReview={goToReview}
          />
        )}

        {page === 'snap' && (
          <SnapSheet
            cards={mistakes}
            from={roundNow.current === 'snap' ? 'today' : mistakes.length === 0 ? 'empty' : 'tab'}
            onSave={addCard}
            onUpdate={updateCard}
            onRemove={removeCard}
            onTryNow={(id) => {
              setManualReviewId(id);
              go('review');
            }}
            onClose={() => go('today')}
            onPro={() => go('me/pro')}
            onReviewNow={goToReview}
          />
        )}

        {page === 'library' && (
          <LibraryPage
            showForm={showForm}
            editingId={editingId}
            formRef={formRef}
            handleSubmit={handleSubmit}
            form={form}
            handleChange={handleChange}
            subjectNames={subjectNames}
            categorySuggestions={categorySuggestions}
            formError={formError}
            subjectFilters={subjectFilters}
            subjectNow={subjectNow}
            selectSubject={selectSubject}
            categoryFilters={categoryFilters}
            categoryNow={categoryNow}
            selectCategory={selectCategory}
            filteredMistakes={filteredMistakes}
            mistakes={mistakes}
            setShowTutorial={setShowTutorial}
            visibleMistakes={visibleMistakes}
            setManualReviewId={setManualReviewId}
            go={go}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            showAll={showAll}
            setShowAll={setShowAll}
          />
        )}

        {examView && examView !== 'report' && <ExamSegments view={examView} />}

        {examView === 'path' && pathState.diagnostic && (
          <a className="mq-report-link" href={pageHref('exam/report')}>
            <span>
              <b>Your diagnostic report</b>
              {pathState.diagnostic.analysis ? 'AI coach analysis, every mistake, and cards to fix them' : 'Get the AI coach analysis and fix every mistake'}
            </span>
            <span aria-hidden="true">→</span>
          </a>
        )}

        {(examView === 'path' || (examView === 'mocks' && pathInfo?.engine === 'sat')) && (
          <PathPage
            plan={plan}
            onSwitchPath={switchPath}
            onSaveMock={recordMock}
            state={pathState}
            cards={mistakes}
            reviews={reviewLog}
            onSavePath={choosePath}
            onSaveDiagnostic={recordDiagnostic}
            onAnalyze={rerunAnalysis}
            onAddCards={addDiagnosticCards}
            onReviewSubject={reviewSubjectFromPath}
            canReview={(subject) => reviewTabs.some((t) => sameName(t.name, subject))}
            onReload={reloadPath}
          />
        )}

        {page === 'admin' && isAdmin && <AdminStats />}

        {examView === 'practice' && <Practice plan={plan} onAddCards={addPracticeCards} onRemoveCards={removePracticeCards} />}

        {examView === 'report' &&
          (pathState.status === 'loading' ? (
            <p className="path-loading">Loading your report…</p>
          ) : (
            <DiagnosticReport
              key={pathState.diagnostic?.id || 'none'}
              pathInfo={pathInfo}
              pathState={pathState}
              fresh={freshReport}
              onAnalyze={rerunAnalysis}
              onAddCards={addDiagnosticCards}
              onReview={goToReview}
              userId={session.user.id}
            />
          ))}

        {page === 'me' && sub === 'pro' && <ProPage plan={plan} onPlan={setPlan} email={session.user.email} />}

        {examView === 'mocks' && pathInfo?.engine !== 'sat' && (
          <MockCenter
            state={pathState}
            cards={mistakes}
            reviews={reviewLog}
            onSaveMock={recordMock}
            onAddBank={addBankQuestions}
            onDeleteBank={removeBankQuestion}
            onAddCards={addDiagnosticCards}
            onReload={reloadPath}
          />
        )}

        {page === 'me' && !sub && (
          <>
            <Profile
              user={session.user}
              cards={mistakes}
              reviews={reviewLog}
              onSave={saveProfile}
              onLogout={logOut}
              onTutorial={() => setShowTutorial(true)}
            />
            <MeExtras plan={plan} isAdmin={isAdmin} />
          </>
        )}


        </Suspense>
        </PageErrorBoundary>
      </main>

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

export default App;

