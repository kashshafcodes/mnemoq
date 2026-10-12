
import { useEffect, useRef, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import Auth from './Auth';

import MnemoqLogo from './components/MnemoqLogo';

const STORAGE_KEY = 'mnemoq-mistakes';

const emptyForm = {
  category: 'Vocabulary',
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
  const answerRef = useRef(null);
  const formRef = useRef(null);
  const reviewCardRef = useRef(null);
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
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  

  
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

  
useEffect(() => {
  if (!revealedAnswer) return;

  const frame = requestAnimationFrame(() => {
    answerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });

  return () => cancelAnimationFrame(frame);
}, [revealedAnswer]);


  function handleChange(event) {
    const { name, value } = event.target;

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
    setRevealedAnswer(false);
    setReviewIndex(0);
  } catch (error) {
    console.error('Could not save review rating:', error.message);
    setDataError(error.message);
  }
}






async function handleSubmit(event) {
  event.preventDefault();
  setDataError('');

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

  const mistake = {
    id: mistakeId,
    user_id: userId,
    subject: existingMistake?.subject || 'English',
    category: form.category,
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
                ...form,
                subject: mistake.subject,
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


function handleEdit(mistake) {
  setForm({
    category: mistake.category,
    question: mistake.question,
    yourAnswer: mistake.yourAnswer,
    correctAnswer: mistake.correctAnswer,
    explanation: mistake.explanation,
  });

  setEditingId(mistake.id);
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

  const categories = [
  'All',
  'Vocabulary',
  'Grammar',
  'Sentence structure',
];

const filteredMistakes =
  activeCategory === 'All'
    ? mistakes
    : mistakes.filter(
        (mistake) => mistake.category === activeCategory
      );


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
            My mistakes
          </a>
          <a className="nav-item" href="#review">
            Review cards
          </a>
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
        setRevealedAnswer(false);
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
            <h2>Learn from what you missed.</h2>
            <p>Every mistake you understand is progress you keep.</p>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? 'Close form' : '+ Add a mistake'}
            </button>
          </div>
          <div className="welcome-mark">m.</div>
        </section>

        {showForm && (
          <section ref={formRef} className="mistake-form-card">
            <h2>{editingId !== null ? 'Edit mistake' : 'Record a mistake'}</h2>
            <p className="subtitle">
              Capture what went wrong and what you learned.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                <option>Vocabulary</option>
                <option>Grammar</option>
                <option>Sentence structure</option>
              </select>

              <label htmlFor="question">Question or prompt</label>
              <textarea
                id="question"
                name="question"
                value={form.question}
                onChange={handleChange}
                placeholder="What question did you get wrong?"
                required
              />

              <label htmlFor="yourAnswer">Your incorrect answer</label>
              <input
                id="yourAnswer"
                name="yourAnswer"
                value={form.yourAnswer}
                onChange={handleChange}
                placeholder="What did you answer?"
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

              <label htmlFor="explanation">Explanation</label>
              <textarea
                id="explanation"
                name="explanation"
                value={form.explanation}
                onChange={handleChange}
                placeholder="Why is this the correct answer?"
                required
              />

              <button type="submit">
                {editingId !== null ? 'Save changes' : 'Save mistake'}
              </button>  
            </form>
          </section>
        )}

        
<section className="stats-grid">
  <article className="stat-card">
    <p>Total mistakes</p>
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
  <h2>Your mistake library</h2>
  <p className="subtitle">
    Every entry is a chance to improve.
  </p>
</section>

<div className="category-filters" aria-label="Filter mistakes by category">
  {categories.map((category) => (
    <button
      key={category}
      type="button"
      className={
        activeCategory === category
          ? 'filter-button selected'
          : 'filter-button'
      }
      aria-pressed={activeCategory === category}
      onClick={() => setActiveCategory(category)}
    >
      {category}
    </button>
  ))}
</div>


        
{filteredMistakes.length === 0 ? (
  <section className="empty-state">
    <div className="empty-icon">✳</div>
    <h3>
      {mistakes.length === 0
        ? 'Your journey starts with one mistake.'
        : 'No mistakes in this category yet.'}
    </h3>
    <p>
      {mistakes.length === 0
        ? 'Add a vocabulary, grammar, or sentence-structure mistake to begin your learning library.'
        : 'Choose another category or add a mistake in this category.'}
    </p>
  </section>
) : (
  <section className="mistake-list">
    {filteredMistakes.map((mistake) => (
      <article className="mistake-card" key={mistake.id}>
        <div className="mistake-card-top">
          <span className="category-tag">
            {mistake.category}
          </span>
          <span className="subject-tag">
            {mistake.subject}
          </span>
        </div>

        <h3>{mistake.question}</h3>
        <p>
          <strong>Your answer:</strong> {mistake.yourAnswer}
        </p>
        <p>
          <strong>Correct answer:</strong> {mistake.correctAnswer}
        </p>
        <p className="explanation">{mistake.explanation}</p>

        <div className="mistake-actions">
          
<button
  className="secondary-button"
  onClick={() => {
    setManualReviewId(mistake.id);
    setRevealedAnswer(false);
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
  </section>
)}

<section className="review-section" id="review">
  <div className="section-heading">
    <div>
      <p className="eyebrow">ACTIVE RECALL</p>
      <h2>Review your mistakes</h2>
      <p>Try to remember the answer before revealing it.</p>
    </div>
  </div>

  
{!reviewMistake ? (
  
<div className="review-empty-state">
  <h3>You're all caught up!</h3>
  <p>
    No mistakes are due for review right now.
  </p>
  <p>
    You have {mistakes.length} saved mistakes in your library.
    They'll return to your review queue when they're due.
  </p>
</div>

) : (

    <div className="review-card">
      <div className="review-card-top">
        <span className="category-badge">
          {reviewMistake.category}
        </span>
        <span className="review-counter">
  Card {reviewIndex + 1} of {reviewQueue.length}
</span>
      </div>

      <h3 className="review-question">
        {reviewMistake.question}
      </h3>

      {!revealedAnswer ? (
        
<button
  className="primary-button"
  onClick={() => {
    setRevealedAnswer(true);

    setTimeout(() => {
      reviewCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }}
>
  Reveal answer
</button>

      ) : (
        <div className="review-answer" ref={answerRef}>
          <div className="answer-block">
            <p className="eyebrow">YOUR ORIGINAL ANSWER</p>
            <p>{reviewMistake.yourAnswer || "Not provided"}</p>
          </div>

          <div className="answer-block correct-answer-block">
            <p className="eyebrow">CORRECT ANSWER</p>
            <p>{reviewMistake.correctAnswer}</p>
          </div>

          <div className="answer-block">
            <p className="eyebrow">EXPLANATION</p>
            <p>{reviewMistake.explanation || "No explanation added."}</p>
          </div>

          

<div className="review-rating-buttons">
  <button
    className="rating-button rating-again"
    onClick={() => handleReviewRating('again')}
  >
    Again
    <span>10 minutes</span>
  </button>

  <button
    className="rating-button rating-hard"
    onClick={() => handleReviewRating('hard')}
  >
    Hard
    <span>1 day</span>
  </button>

  <button
    className="rating-button rating-good"
    onClick={() => handleReviewRating('good')}
  >
    Good
    <span>1+ days</span>
  </button>

  <button
    className="rating-button rating-easy"
    onClick={() => handleReviewRating('easy')}
  >
    Easy
    <span>3+ days</span>
  </button>
</div>


        </div>
      )}
    </div>
  )}
</section>

      </main>
    </div>
  );
}

export default App;

