
import { useEffect, useRef, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import Auth from './Auth';

import MnemoqLogo from './components/MnemoqLogo';
import Tutorial from './components/Tutorial';
import ReviewCard from './components/ReviewCard';
import QuickAdd from './components/QuickAdd';
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
  
  const [reviewIndex, setReviewIndex] = useState(0);
  const [manualReviewId, setManualReviewId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [activeSubject, setActiveSubject] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);


  
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

  

async function handleReviewRating(rating) {
  if (!reviewMistake) return;

  const userId = session?.user?.id;

  if (!userId) {
    setDataError('Please log in before reviewing a mistake.');
    return;
  }

  const now = new Date();
  let nextReviewAt;
  let nextIntervalDays = reviewMistake.reviewIntervalDays || 0;

  switch (rating) {
    case 'again':
      nextIntervalDays = 0;
      nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
      break;

    case 'hard':
      nextIntervalDays = Math.max(1, nextIntervalDays);
      nextReviewAt = new Date(
        now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000
      );
      break;

    case 'good':
      nextIntervalDays = Math.max(1, nextIntervalDays * 2 || 1);
      nextReviewAt = new Date(
        now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000
      );
      break;

    case 'easy':
      nextIntervalDays = Math.max(3, nextIntervalDays * 3 || 3);
      nextReviewAt = new Date(
        now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000
      );
      break;

    default:
      return;
  }

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

    setManualReviewId(null);
    setReviewIndex(0);
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
      createdAt: row.created_at,
      nextReviewAt: row.next_review_at,
      reviewCount: row.review_count,
      reviewIntervalDays: row.review_interval_days,
      mastered: row.mastered,
    },
    ...current,
  ]);

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



  const dueCount = mistakes.filter(
    (mistake) => !mistake.mastered
  ).length;

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

const reviewQueue = dueMistakes;




const reviewMistake =
  manualReviewId !== null
    ? mistakes.find((mistake) => mistake.id === manualReviewId) || null
    : reviewQueue.length > 0
      ? reviewQueue[reviewIndex % reviewQueue.length]
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


  return (
    <div className="app">
      <aside className="sidebar">
        <MnemoqLogo size={36} />
        <p className="nav-label">WORKSPACE</p>

        <nav>
          <a className="nav-item active" href="#dashboard">
            Dashboard
          </a>
          <a className="nav-item" href="#mistakes">
            My library
          </a>
          <a className="nav-item" href="#review">
            Review cards
          </a>
          <button
            type="button"
            className="nav-item nav-button"
            onClick={() => setShowTutorial(true)}
          >
            How it works
          </button>
        </nav>

        
<div className="sidebar-bottom">
  <p>Small improvements.</p>
  <p>Lasting knowledge.</p>

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
      }
    }}
  >
    Log out
  </button>
</div>

      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR LEARNING SPACE</p>
            <h1>Good to see you.</h1>
            <p className="subtitle">
              Turn today's mistakes into tomorrow's strengths.
            </p>
          </div>
          <div className="avatar">M</div>
        </header>

        <section className="welcome-card">
          <div>
            <p className="eyebrow">YOUR NEXT STEP</p>
            <h2>Remember better, one card at a time.</h2>
            <p>
              Add what you want to remember, then bring it back at just the
              right moment.
            </p>
            <div className="welcome-actions">
              <button
                type="button"
                onClick={() => {
                  if (showForm) {
                    setShowForm(false);
                    setEditingId(null);
                    setForm(emptyForm);
                  } else {
                    setShowForm(true);
                  }
                }}
              >
                {showForm ? 'Close form' : '+ Add a card'}
              </button>
              {dueMistakes.length > 0 && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    document.getElementById('review')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                >
                  Review now ({dueMistakes.length} due)
                </button>
              )}
            </div>
          </div>
          <div className="welcome-mark">m.</div>
        </section>

        {showForm && editingId === null && (
          <QuickAdd
            cards={mistakes}
            onSave={addCard}
            onClose={() => setShowForm(false)}
            onReviewNow={() => {
              setShowForm(false);
              requestAnimationFrame(() => {
                document.getElementById('review')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              });
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

        
<section className="stats-grid">
  <article className="stat-card">
    <p>Total cards</p>
    <h2>{mistakes.length}</h2>
    <span>Your learning library</span>
  </article>

  <article className="stat-card">
    <p>Due today</p>
    <h2>{dueMistakes.length}</h2>
    <span>Ready for active recall</span>
  </article>

  <article className="stat-card">
    <p>To review</p>
    <h2>{dueCount}</h2>
    <span>Items not yet mastered</span>
  </article>

  <article className="stat-card">
    <p>Mastered</p>
    <h2>{mistakes.filter((m) => m.mastered).length}</h2>
    <span>Knowledge reinforced</span>
  </article>
</section>


        
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

  
{!reviewMistake ? (
  
<div className="review-empty-state">
  <h3>You're all caught up!</h3>
  <p>
    No cards are due for review right now.
  </p>
  <p>
    You have {mistakes.length} saved card{mistakes.length === 1 ? '' : 's'} in your library.
    They'll return to your review queue when they're due.
  </p>
</div>

) : (

    <ReviewCard
      key={`${reviewMistake.id}-${reviewMistake.reviewCount || 0}`}
      card={reviewMistake}
      cards={mistakes}
      position={{
        index: manualReviewId !== null ? 0 : reviewIndex % reviewQueue.length,
        total: manualReviewId !== null ? 1 : reviewQueue.length,
      }}
      onRate={handleReviewRating}
    />
  )}
</section>

      </main>

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

export default App;

