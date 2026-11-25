import ReviewCard from './ReviewCard';
import Jonaki from './Jonaki';
import { useLoopT } from '../loop/strings';
import { ReviewSubjectTabs, SessionStart, SessionSummary } from './SessionPanels';
import { SESSION_SIZE } from '../quiz';
import { sameName } from '../subjects';
import { pageHref } from '../useRoute';

// The Review page: pick a subject, run a short session, see how it went.
export default function ReviewPage({
  pathInfo,
  reviewMistake,
  sessionFinished,
  reviewTabs,
  activeReviewSubject,
  reviewSubjectFromPath,
  dueMistakes,
  chooseReviewSubject,
  sessionRunning,
  endSession,
  mistakes,
  manualReviewId,
  reviewSession,
  handleReviewRating,
  scopedDue,
  startSession,
  setReviewSession,
  dailyPlayed = false,
  go,
  roundNext = null,
}) {
  const t = useLoopT();

  return (
    <>
      <section className="review-section" id="review">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ACTIVE RECALL</p>
            <h2>Review your cards</h2>
            <p>Pick or type your answer first. Recalling it beats re-reading it.</p>
          </div>
        </div>

        {pathInfo && !reviewMistake && !sessionFinished && (
          <div className="review-path">
            <span>
              <b>{pathInfo.short} prep</b>
              {pathInfo.daysLeft !== null && ` · ${pathInfo.daysLeft} ${pathInfo.daysLeft === 1 ? 'day' : 'days'} left`}
              {pathInfo.readiness !== null && ` · ${pathInfo.word} ${pathInfo.readiness} of ${pathInfo.target}`}
            </span>
            {pathInfo.weakest &&
              reviewTabs.some((tab) => sameName(tab.name, pathInfo.weakest.cardSubject)) &&
              !sameName(activeReviewSubject, pathInfo.weakest.cardSubject) && (
                <button type="button" className="text-link" onClick={() => reviewSubjectFromPath(pathInfo.weakest.cardSubject)}>
                  Focus on {pathInfo.weakest.name}, your weakest
                </button>
              )}
            <a className="text-link" href={pageHref('exam')}>
              Open my path
            </a>
          </div>
        )}

        {!reviewMistake && !sessionFinished && (
          <ReviewSubjectTabs tabs={reviewTabs} active={activeReviewSubject} totalDue={dueMistakes.length} onChange={chooseReviewSubject} />
        )}

        {reviewMistake ? (
          <>
            {sessionRunning && (
              <div className="session-bar">
                <span>{activeReviewSubject ? `${activeReviewSubject} session` : 'Short session'}</span>
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
            dailyPlayed={dailyPlayed}
            roundNext={
              roundNext && {
                ...roundNext,
                onContinue: () => {
                  setReviewSession(null);
                  roundNext.onContinue();
                },
              }
            }
            onAgain={startSession}
            onStop={() => {
              setReviewSession(null);
              go('today');
            }}
            onDaily={() => {
              setReviewSession(null);
              go('daily');
            }}
            onDoneToday={() => {
              setReviewSession(null);
              go('done');
            }}
          />
        ) : scopedDue.length > 0 ? (
          <SessionStart dueCards={scopedDue} subject={activeReviewSubject} sessionSize={SESSION_SIZE} onStart={startSession} />
        ) : (
          <div className="review-empty-state">
            {mistakes.length === 0 ? (
              <>
                <Jonaki mood="idle" size={84} />
                <h3>{t('empty.noCards.title')}</h3>
                <p>{t('empty.noCards.body')}</p>
                <div className="mq-empty-actions">
                  {!dailyPlayed && (
                    <a className="mq-btn mq-btn-primary" href={pageHref('daily')}>
                      {t('empty.noCards.daily')}
                    </a>
                  )}
                  <a className={`mq-btn ${dailyPlayed ? 'mq-btn-primary' : 'mq-btn-ghost'}`} href={pageHref('snap')}>
                    {t('empty.noCards.add')}
                  </a>
                </div>
              </>
            ) : (
              <>
                <Jonaki mood="sleep" size={84} />
                <h3>{activeReviewSubject ? t('empty.nothingDue.subject', { subject: activeReviewSubject }) : t('empty.nothingDue.title')}</h3>
                <p>
                  {activeReviewSubject && dueMistakes.length > 0
                    ? t('empty.nothingDue.otherSubject')
                    : t('empty.nothingDue.body', { n: mistakes.length })}
                </p>
                <div className="mq-empty-actions">
                  {activeReviewSubject && dueMistakes.length > 0 ? (
                    <button type="button" className="mq-btn mq-btn-primary" onClick={() => chooseReviewSubject(null)}>
                      {t('play.title')}
                    </button>
                  ) : !dailyPlayed ? (
                    <a className="mq-btn mq-btn-primary" href={pageHref('daily')}>
                      {t('empty.nothingDue.daily')}
                    </a>
                  ) : (
                    <a className="mq-btn mq-btn-primary" href={pageHref('done')}>
                      {t('session.next.done')}
                    </a>
                  )}
                  <a className="mq-btn mq-btn-ghost" href={pageHref('practice')}>
                    {t('empty.practice')}
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
