import RichText from './RichText';
import { NO_SUGGEST } from '../noSuggest';
import { subjectAccent } from '../subjects';
import { pageHref } from '../useRoute';
import Jonaki from './Jonaki';
import { dailyStatus } from '../daily/DailyTile';
import { useLoopT } from '../loop/strings';
import { feel } from '../sensory';

// How many cards show before "See all".
export const COLLAPSED_COUNT = 3;

// The Library page: every saved card, filters by subject and category, and
// the edit form.
export default function LibraryPage({
  showForm,
  editingId,
  formRef,
  handleSubmit,
  form,
  handleChange,
  subjectNames,
  categorySuggestions,
  formError,
  subjectFilters,
  subjectNow,
  selectSubject,
  categoryFilters,
  categoryNow,
  selectCategory,
  filteredMistakes,
  mistakes,
  setShowTutorial,
  visibleMistakes,
  setManualReviewId,
  go,
  handleEdit,
  handleDelete,
  showAll,
  setShowAll,
}) {
  return (
    <>
      {showForm && editingId !== null && (
        <section ref={formRef} className="mistake-form-card">
          <h2>{editingId !== null ? 'Edit card' : 'Add a card'}</h2>
          <p className="subtitle">Only the question and correct answer are required.</p>

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
              {...NO_SUGGEST}
            />

            <label htmlFor="correctAnswer">Correct answer</label>
            <input
              id="correctAnswer"
              name="correctAnswer"
              value={form.correctAnswer}
              onChange={handleChange}
              placeholder="What is the correct answer?"
              required
              {...NO_SUGGEST}
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
              {...NO_SUGGEST}
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
              {...NO_SUGGEST}
            />

            {formError && (
              <p className="qa-message qa-error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit">{editingId !== null ? 'Save changes' : 'Save card'}</button>
          </form>
        </section>
      )}

      <section className="section-heading" id="mistakes">
        <h2>Your library</h2>
        <p className="subtitle">Everything you're learning, in one place.</p>
        <div className="mq-section-actions">
          <a className="mq-btn mq-btn-primary" href={pageHref('add')}>
            + Add cards
          </a>
          <a className="mq-btn mq-btn-ghost" href={pageHref('progress')}>
            See progress
          </a>
        </div>
      </section>

      <div className="category-filters" aria-label="Filter cards by subject">
        {subjectFilters.map((subject) => (
          <button
            key={subject}
            type="button"
            className={subjectNow === subject ? 'filter-button selected' : 'filter-button'}
            style={subject === 'All' ? undefined : { '--subject': subjectAccent(subject) }}
            aria-pressed={subjectNow === subject}
            onClick={() => selectSubject(subject)}
          >
            {subject !== 'All' && <span className="subject-dot" aria-hidden="true" />}
            {subject}
          </button>
        ))}
      </div>

      {categoryFilters.length > 0 && (
        <div className="category-filters sub-filters" aria-label="Filter cards by category">
          {categoryFilters.map((category) => (
            <button
              key={category}
              type="button"
              className={categoryNow === category ? 'filter-button selected' : 'filter-button'}
              aria-pressed={categoryNow === category}
              onClick={() => selectCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {filteredMistakes.length === 0 ? (
        <LibraryEmpty noCards={mistakes.length === 0} onTutorial={() => setShowTutorial(true)} />
      ) : (
        <section className="mistake-list fx-list">
          {visibleMistakes.map((mistake) => (
            <article className="mistake-card accented" key={mistake.id} style={{ '--subject': subjectAccent(mistake.subject) }}>
              <div className="mistake-card-top">
                <span className="subject-tag">
                  <span className="subject-dot" aria-hidden="true" />
                  {mistake.subject}
                </span>
                <span className="category-tag">{mistake.category}</span>
              </div>

              <h3>
                <RichText text={mistake.question} graphs={false} />
              </h3>
              {mistake.yourAnswer && (
                <p>
                  <strong>Your answer:</strong> <RichText text={mistake.yourAnswer} graphs={false} />
                </p>
              )}
              <p>
                <strong>Correct answer:</strong>{' '}
                <span className="correct-text">
                  <RichText text={mistake.correctAnswer} graphs={false} />
                </span>
              </p>
              {mistake.explanation && (
                <p className="explanation">
                  <strong>Memory hook:</strong> <RichText text={mistake.explanation} graphs={false} />
                </p>
              )}

              <div className="mistake-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    feel('tap.primary');
                    setManualReviewId(mistake.id);
                    go('review');
                  }}
                >
                  Review now
                </button>

                <button type="button" onClick={() => handleEdit(mistake)}>
                  Edit
                </button>
                <button type="button" className="delete-button" onClick={() => handleDelete(mistake.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}

          {filteredMistakes.length > COLLAPSED_COUNT && (
            <div className="see-all-row">
              <button type="button" className="see-all-button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `See all ${filteredMistakes.length} cards`}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

// No cards yet, or none in this filter: always a way forward.
function LibraryEmpty({ noCards, onTutorial }) {
  const t = useLoopT();
  const dailyPlayed = Boolean(dailyStatus().today);

  return (
    <section className="empty-state fx-empty">
      <Jonaki mood={noCards ? 'idle' : 'think'} size={72} />
      <h3>{noCards ? t('empty.noCards.title') : 'No cards match this filter yet.'}</h3>
      <p>{noCards ? t('empty.noCards.body') : 'Choose another subject or category, or add a card here.'}</p>
      <div className="mq-empty-actions">
        <a className="mq-btn mq-btn-primary" href={pageHref('add')}>
          {t('empty.noCards.add')}
        </a>
        {noCards && !dailyPlayed && (
          <a className="mq-btn mq-btn-ghost" href={pageHref('daily')}>
            {t('empty.noCards.daily')}
          </a>
        )}
        {noCards && dailyPlayed && (
          <a className="mq-btn mq-btn-ghost" href={pageHref('practice')}>
            {t('empty.practice')}
          </a>
        )}
      </div>
      {noCards && (
        <button type="button" className="text-link" onClick={onTutorial}>
          New here? See how it works
        </button>
      )}
    </section>
  );
}
